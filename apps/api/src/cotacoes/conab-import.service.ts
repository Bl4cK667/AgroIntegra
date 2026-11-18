import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { CronJob } from 'cron';
import { randomUUID } from 'node:crypto';
import { ExternalSourceError, fetchExternal, FetchLike } from '../common/external-http';
import { PrismaService } from '../prisma/prisma.service';
import { ConabFile, ConabRow, parseConabFile } from './conab-file';
import { COTACOES_CONFIG, COTACOES_FETCH, CotacoesConfig } from './cotacoes.config';

// Importação dos preços semanais da CONAB para MarketPrice (tabela GLOBAL: preço público, igual para
// todas as organizações; por isso o SQL bruto aqui não filtra organizationId).
// - Download condicional (If-Modified-Since): a CONAB atualiza uma vez por semana.
// - Gravação idempotente: chave (fonte, escopo, praça, produto, semana); repetir não duplica.
// - Falha da fonte não apaga nada: a tela continua com o último valor, com aviso de desatualizado.

export interface ImportResult {
  file: ConabFile;
  status: 'SUCCESS' | 'NOT_MODIFIED' | 'FAILED' | 'RUNNING';
  rows: number;
  message: string;
}

const FILES: Record<ConabFile, string> = { UF: 'PrecosSemanalUF.txt', MUNICIPIO: 'PrecosSemanalMunicipio.txt' };
const SOURCE = 'CONAB';
const BATCH = 500;
const JOB_NAME = 'cotacoes-conab';

@Injectable()
export class ConabImportService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ConabImportService.name);
  private running: Promise<ImportResult[]> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduler: SchedulerRegistry,
    @Inject(COTACOES_CONFIG) private readonly config: CotacoesConfig,
    @Inject(COTACOES_FETCH) private readonly fetchFn: FetchLike,
  ) {}

  onApplicationBootstrap() {
    if (!this.config.scheduleEnabled) return;
    const job = CronJob.from({
      cronTime: this.config.cron,
      timeZone: this.config.timezone,
      onTick: () => void this.importAll('agendada'),
    });
    this.scheduler.addCronJob(JOB_NAME, job);
    job.start();
    this.logger.log(JSON.stringify({ event: 'cotacoes_schedule', cron: this.config.cron, timezone: this.config.timezone, ufs: this.config.ufs }));
    if (this.config.importOnStart) void this.importIfOld();
  }

  onModuleDestroy() {
    if (this.scheduler.doesExist('cron', JOB_NAME)) this.scheduler.deleteCronJob(JOB_NAME);
  }

  private async importIfOld() {
    const last = await this.prisma.marketPriceImport.findFirst({ where: { source: SOURCE, status: 'SUCCESS' }, orderBy: { startedAt: 'desc' } });
    if (!last || Date.now() - last.startedAt.getTime() > 7 * 86_400_000) await this.importAll('na inicialização');
  }

  // Uma importação por vez: chamadas durante uma em andamento recebem o resultado dela.
  importAll(trigger: string, opts: { force?: boolean } = {}): Promise<ImportResult[]> {
    if (!this.running) {
      this.running = this.runAll(trigger, opts).finally(() => (this.running = null));
    }
    return this.running;
  }

  private async runAll(trigger: string, opts: { force?: boolean }) {
    const files: ConabFile[] = this.config.includeMunicipalities ? ['UF', 'MUNICIPIO'] : ['UF'];
    const results: ImportResult[] = [];
    for (const file of files) results.push(await this.importFile(file, trigger, opts.force === true));
    return results;
  }

  private async importFile(file: ConabFile, trigger: string, force: boolean): Promise<ImportResult> {
    const startedAt = new Date();
    const last = await this.prisma.marketPriceImport.findFirst({
      where: { source: SOURCE, file, status: 'SUCCESS', lastModified: { not: null } },
      orderBy: { startedAt: 'desc' },
    });
    const url = `${this.config.conabBaseUrl}/${FILES[file]}`;
    try {
      const res = await fetchExternal(
        this.fetchFn,
        url,
        {
          source: 'CONAB',
          timeoutMs: this.config.timeoutMs,
          retryDelaysMs: this.config.retryDelaysMs,
          headers: { accept: 'text/plain', ...(last?.lastModified && !force ? { 'if-modified-since': last.lastModified } : {}) },
          acceptStatus: [304],
        },
        this.logger,
      );
      if (res.status === 304) {
        await this.record(file, 'NOT_MODIFIED', 0, last?.lastModified ?? null, null, startedAt);
        return { file, status: 'NOT_MODIFIED', rows: 0, message: 'Sem atualização desde a última importação.' };
      }
      if (!res.arrayBuffer) throw new ExternalSourceError('CONAB', 'Resposta da CONAB sem conteúdo.');
      const buf = Buffer.from(await res.arrayBuffer());
      const { rows, skipped } = parseConabFile(buf, file, new Set(this.config.ufs));
      if (!rows.length) throw new ExternalSourceError('CONAB', `O arquivo da CONAB não trouxe preço recebido pelo produtor para ${this.config.ufs.join(', ')}.`);
      const written = await this.upsert(rows);
      const lastModified = res.headers?.get('last-modified') ?? null;
      await this.record(file, 'SUCCESS', written, lastModified, null, startedAt);
      this.logger.log(JSON.stringify({ event: 'cotacoes_import', trigger, file, rows: rows.length, written, skipped, bytes: buf.length, ms: Date.now() - startedAt.getTime() }));
      return { file, status: 'SUCCESS', rows: rows.length, message: `${rows.length.toLocaleString('pt-BR')} preços semanais importados.` };
    } catch (e) {
      const message = e instanceof ExternalSourceError ? e.message : 'Erro inesperado ao importar o arquivo da CONAB.';
      this.logger.error(JSON.stringify({ event: 'cotacoes_import_failed', trigger, file, error: e instanceof Error ? e.message : String(e) }));
      await this.record(file, 'FAILED', 0, null, message, startedAt);
      return { file, status: 'FAILED', rows: 0, message };
    }
  }

  // INSERT ... ON CONFLICT em lotes; só atualiza a linha quando o valor publicado mudou.
  private async upsert(rows: ConabRow[]): Promise<number> {
    let written = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const values = rows.slice(i, i + BATCH).map(
        (r) => Prisma.sql`(${randomUUID()}, ${SOURCE}, ${r.productCode}, ${r.productName}, ${r.productClass},
          ${r.scope}::"MarketPriceScope", ${r.uf}, ${r.ibgeCode}, ${r.placeKey}, ${r.placeName},
          ${r.weekStart}::date, ${r.weekEnd}::date, ${r.value}, now(), now())`,
      );
      written += await this.prisma.$executeRaw`
        INSERT INTO "MarketPrice" (id, source, "productCode", "productName", "productClass", scope, uf, "ibgeCode",
          "placeKey", "placeName", "weekStart", "weekEnd", value, "createdAt", "updatedAt")
        VALUES ${Prisma.join(values)}
        ON CONFLICT (source, scope, "placeKey", "productCode", "weekStart") DO UPDATE SET
          value = EXCLUDED.value, "weekEnd" = EXCLUDED."weekEnd", "productName" = EXCLUDED."productName",
          "productClass" = EXCLUDED."productClass", "placeName" = EXCLUDED."placeName", "updatedAt" = now()
        WHERE "MarketPrice".value IS DISTINCT FROM EXCLUDED.value OR "MarketPrice"."placeName" IS DISTINCT FROM EXCLUDED."placeName"`;
    }
    return written;
  }

  private record(file: ConabFile, status: string, rows: number, lastModified: string | null, error: string | null, startedAt: Date) {
    return this.prisma.marketPriceImport.create({ data: { source: SOURCE, file, status, rows, lastModified, error, startedAt, finishedAt: new Date() } });
  }
}
