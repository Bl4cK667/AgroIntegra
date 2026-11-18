import { BadRequestException, Inject, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma, WeatherForecast } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenancyService } from '../tenancy/tenancy.service';
import { CLIMA_CONFIG, ClimaConfig } from './clima.config';
import { ExternalSourceError } from './http-json';
import { IbgeClient, Municipality } from './ibge.client';
import { InmetClient } from './inmet.client';
import { gridPoint, OpenMeteoClient } from './open-meteo.client';
import { SOURCE_ATTRIBUTION, SOURCE_LABEL, SourceForecast, WeatherDay, WeatherSourceName } from './weather.types';

export interface ForecastView {
  source: WeatherSourceName;
  sourceLabel: string;
  attribution: string;
  place: string;
  fetchedAt: Date; // data/hora do dado (quando a fonte respondeu)
  stale: boolean; // true = a fonte falhou e este é o último valor válido
  warning: string | null;
  days: WeatherDay[];
}

const MINUTE = 60_000;
// Sem nenhum valor guardado, a espera depois de uma falha é curta: o usuário não fica sem previsão
// por muito tempo se a fonte voltar logo; só evita repetir a consulta lenta a cada clique.
const NO_CACHE_BACKOFF_MS = MINUTE;

@Injectable()
export class ClimaService {
  private readonly logger = new Logger(ClimaService.name);
  // Falha recente sem nenhum valor guardado: evita consultar de novo uma fonte fora do ar a cada tela aberta.
  private readonly recentFailures = new Map<string, { at: number; message: string }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenancy: TenancyService,
    private readonly inmet: InmetClient,
    private readonly openMeteo: OpenMeteoClient,
    private readonly ibge: IbgeClient,
    @Inject(CLIMA_CONFIG) private readonly config: ClimaConfig,
  ) {}

  // Previsão para uma propriedade: INMET pelo município do cadastro (ou o padrão do .env) e,
  // com o Open-Meteo ligado e a propriedade localizada, a previsão no ponto (com chuva em mm).
  async forProperty(propertyId: string) {
    const property = await this.prisma.property.findUnique({ where: { id: propertyId } });
    if (!property || property.deletedAt) throw new NotFoundException('Propriedade não encontrada.');

    const warnings: string[] = [];
    const municipality = await this.municipalityOf(property.city, property.state, warnings);

    const jobs: Promise<ForecastView>[] = [];
    if (municipality) jobs.push(this.inmetForecast(municipality));
    if (this.openMeteo.enabled && property.latitude !== null && property.longitude !== null) {
      const point = gridPoint(property.latitude, property.longitude);
      const place = `Ponto da propriedade (${point.lat.toLocaleString('pt-BR')}; ${point.lng.toLocaleString('pt-BR')})`;
      jobs.push(this.cached('OPEN_METEO', point.key, place, () => this.openMeteo.forecast(point.lat, point.lng, place)));
    } else if (this.openMeteo.enabled) {
      warnings.push('Cadastre a localização da propriedade (ou demarque o perímetro) para ver a previsão no ponto, com chuva em mm.');
    }
    if (!jobs.length) {
      throw new BadRequestException('Não há como localizar esta propriedade: informe a cidade e a UF no cadastro.');
    }

    const settled = await Promise.allSettled(jobs);
    const forecasts = settled.filter((s): s is PromiseFulfilledResult<ForecastView> => s.status === 'fulfilled').map((s) => s.value);
    for (const s of settled) if (s.status === 'rejected') warnings.push(errorMessage(s.reason));
    if (!forecasts.length) {
      throw new ServiceUnavailableException(`Previsão do tempo indisponível no momento. ${warnings.join(' ')}`.trim());
    }
    return { property: { id: property.id, name: property.name }, municipality, forecasts, warnings };
  }

  async forMunicipality(ibgeCode: string): Promise<ForecastView> {
    if (!/^\d{7}$/.test(ibgeCode)) throw new BadRequestException('Código IBGE inválido: use os 7 dígitos do município.');
    return this.inmetForecast({ ibgeCode, name: ibgeCode });
  }

  private inmetForecast(m: Municipality) {
    return this.cached('INMET', m.ibgeCode, m.name, () => this.inmet.forecast(m.ibgeCode));
  }

  private async municipalityOf(city: string | null, state: string | null, warnings: string[]) {
    if (city && state) {
      try {
        const found = await this.ibge.resolve(city, state);
        if (found) return { ...found, fromRegistration: true };
        warnings.push(`O município "${city}/${state}" não foi encontrado no IBGE; confira a grafia no cadastro.`);
      } catch (e) {
        warnings.push(`Não foi possível identificar o município no IBGE (${errorMessage(e)}).`);
      }
    } else {
      warnings.push('A propriedade não tem cidade e UF no cadastro.');
    }
    const fallback = this.config.defaultMunicipality;
    if (!fallback) return null;
    warnings.push(`Usando a previsão do município padrão (${fallback.name}).`);
    return { ...fallback, fromRegistration: false };
  }

  // Último valor válido por organização, fonte e local: dentro da validade, não consulta a fonte;
  // se a fonte falhar, devolve o guardado com aviso de desatualizado.
  private async cached(
    source: WeatherSourceName,
    locationKey: string,
    placeName: string,
    fetcher: () => Promise<SourceForecast>,
  ): Promise<ForecastView> {
    const now = Date.now();
    const row = await this.prisma.weatherForecast.findFirst({ where: { source, locationKey, deletedAt: null } });
    if (row && now - row.fetchedAt.getTime() < this.config.cacheMinutes * MINUTE) return this.view(row, false);
    if (row?.lastErrorAt && row.lastErrorAt > row.fetchedAt && now - row.lastErrorAt.getTime() < this.config.failureBackoffMinutes * MINUTE) {
      return this.view(row, true);
    }
    const failureKey = `${this.tenancy.organizationId()}:${source}:${locationKey}`;
    const failure = this.recentFailures.get(failureKey);
    if (!row && failure && now - failure.at < NO_CACHE_BACKOFF_MS) {
      throw new ServiceUnavailableException(unavailable(source, failure.message));
    }

    let result: SourceForecast;
    try {
      result = await fetcher();
    } catch (e) {
      const message = errorMessage(e);
      this.logger.warn(JSON.stringify({ event: 'weather_source_failed', source, locationKey, cached: !!row, error: message }));
      if (!row) {
        this.recentFailures.set(failureKey, { at: now, message });
        throw new ServiceUnavailableException(unavailable(source, message));
      }
      const saved = await this.prisma.weatherForecast.update({ where: { id: row.id }, data: { lastErrorAt: new Date(now), lastError: message } });
      return this.view(saved, true);
    }

    this.recentFailures.delete(failureKey);
    const data = {
      placeName: source === 'INMET' ? result.placeName : placeName,
      days: result.days as unknown as Prisma.InputJsonValue,
      fetchedAt: new Date(now),
      lastErrorAt: null,
      lastError: null,
    };
    return this.view(await this.save(row, source, locationKey, data), false);
  }

  private async save(
    row: WeatherForecast | null,
    source: WeatherSourceName,
    locationKey: string,
    data: { placeName: string; days: Prisma.InputJsonValue; fetchedAt: Date; lastErrorAt: null; lastError: null },
  ) {
    if (row) return this.prisma.weatherForecast.update({ where: { id: row.id }, data });
    try {
      return await this.prisma.weatherForecast.create({ data: { source, locationKey, ...data } as Prisma.WeatherForecastUncheckedCreateInput });
    } catch (e) {
      // Duas consultas ao mesmo tempo: a outra gravou primeiro; atualiza a dela.
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
      const other = await this.prisma.weatherForecast.findFirstOrThrow({ where: { source, locationKey } });
      return this.prisma.weatherForecast.update({ where: { id: other.id }, data });
    }
  }

  private view(row: WeatherForecast, stale: boolean): ForecastView {
    const source = row.source as WeatherSourceName;
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: this.config.timezone }).format(new Date());
    const when = row.fetchedAt.toLocaleString('pt-BR', { timeZone: this.config.timezone, dateStyle: 'short', timeStyle: 'short' });
    return {
      source,
      sourceLabel: SOURCE_LABEL[source],
      attribution: SOURCE_ATTRIBUTION[source],
      place: row.placeName,
      fetchedAt: row.fetchedAt,
      stale,
      warning: stale ? `Previsão desatualizada: o ${SOURCE_LABEL[source]} não respondeu. Mostrando os dados de ${when}.` : null,
      days: (row.days as unknown as WeatherDay[]).filter((d) => d.date >= today),
    };
  }
}

function errorMessage(e: unknown): string {
  if (e instanceof ExternalSourceError) return e.message;
  if (e instanceof Error && 'getStatus' in e) return e.message;
  return 'Falha ao consultar a fonte.';
}

const unavailable = (source: WeatherSourceName, message: string) =>
  `Previsão do ${SOURCE_LABEL[source]} indisponível: ${message} Tente de novo em alguns minutos.`;
