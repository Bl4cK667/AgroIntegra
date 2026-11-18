import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { LocalPrice, MarketPrice, Prisma, Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/current-user.decorator';
import { parseDay, today, toDay } from '../common/dates';
import { PrismaService } from '../prisma/prisma.service';
import { COTACOES_CONFIG, CotacoesConfig } from './cotacoes.config';
import { CreateLocalPriceDto, LocalPriceQueryDto } from './cotacoes.dto';
import { convert, PRODUCT_BY_KEY, TRACKED_PRODUCTS, TrackedProduct } from './products';

const DAY = 86_400_000;
export const CONAB_ATTRIBUTION = 'Fonte: CONAB, Companhia Nacional de Abastecimento (preço recebido pelo produtor, semanal).';

type LocalWithAuthor = LocalPrice & { createdBy: { id: string; name: string } };

@Injectable()
export class CotacoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(COTACOES_CONFIG) private readonly config: CotacoesConfig,
  ) {}

  // Painel: para cada produto acompanhado, o último preço da UF, as praças municipais com dado
  // recente e o último preço lançado pela equipe. Sempre com fonte, praça e semana/data.
  async overview() {
    const cutoff = new Date(Date.now() - this.config.staleDays * DAY);
    const products = [];
    for (const product of TRACKED_PRODUCTS) {
      const where = { source: 'CONAB', productName: product.conab.name, productClass: product.conab.class, uf: { in: this.config.ufs } };
      const states = await this.prisma.marketPrice.findMany({ where: { ...where, scope: 'STATE' }, orderBy: { weekEnd: 'desc' }, take: 2 * this.config.ufs.length });
      const municipal = this.config.includeMunicipalities
        ? await this.prisma.marketPrice.findMany({ where: { ...where, scope: 'MUNICIPALITY', weekEnd: { gte: cutoff } }, orderBy: { weekEnd: 'desc' } })
        : [];
      const local = await this.prisma.localPrice.findFirst({
        where: { productKey: product.key, deletedAt: null },
        orderBy: [{ observedOn: 'desc' }, { createdAt: 'desc' }],
        include: { createdBy: { select: { id: true, name: true } } },
      });
      products.push({
        key: product.key,
        label: product.label,
        unit: product.unit,
        note: product.note ?? null,
        state: this.ufQuotes(product, states),
        municipalities: latestByPlace(municipal).map((m) => this.quote(product, m, null)),
        local: local ? this.localView(local) : null,
      });
    }
    return { products, sources: { conab: CONAB_ATTRIBUTION }, staleDays: this.config.staleDays, imports: await this.importStatus() };
  }

  async history(productKey: string, weeks = 26) {
    const product = PRODUCT_BY_KEY.get(productKey);
    if (!product) throw new NotFoundException('Produto não acompanhado.');
    const from = new Date(Date.now() - weeks * 7 * DAY);
    const rows = await this.prisma.marketPrice.findMany({
      where: { source: 'CONAB', productName: product.conab.name, productClass: product.conab.class, uf: { in: this.config.ufs }, weekEnd: { gte: from } },
      orderBy: [{ weekEnd: 'asc' }],
    });
    const series = new Map<string, { place: string; scope: string; points: { weekStart: string; weekEnd: string; value: number }[] }>();
    for (const r of rows) {
      const s = series.get(r.placeKey) ?? { place: r.placeName, scope: r.scope, points: [] };
      s.points.push({ weekStart: toDay(r.weekStart)!, weekEnd: toDay(r.weekEnd)!, value: convert(product, Number(r.value)) });
      series.set(r.placeKey, s);
    }
    const local = await this.prisma.localPrice.findMany({
      where: { productKey, deletedAt: null, observedOn: { gte: from } },
      orderBy: { observedOn: 'asc' },
      include: { createdBy: { select: { id: true, name: true } } },
    });
    return {
      product: { key: product.key, label: product.label, unit: product.unit, note: product.note ?? null },
      // Média da UF primeiro, depois as praças municipais.
      series: [...series.values()].sort((a, b) => (a.scope === b.scope ? a.place.localeCompare(b.place) : a.scope === 'STATE' ? -1 : 1)),
      local: local.map((l) => this.localView(l)),
      source: CONAB_ATTRIBUTION,
    };
  }

  async listLocal(q: LocalPriceQueryDto) {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const where: Prisma.LocalPriceWhereInput = { deletedAt: null, ...(q.productKey ? { productKey: q.productKey } : {}) };
    const [rows, total] = await Promise.all([
      this.prisma.localPrice.findMany({
        where,
        orderBy: [{ observedOn: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { createdBy: { select: { id: true, name: true } } },
      }),
      this.prisma.localPrice.count({ where }),
    ]);
    return { items: rows.map((r) => this.localView(r)), total, page, pageSize };
  }

  async createLocal(dto: CreateLocalPriceDto, user: AuthUser) {
    const product = dto.productKey ? PRODUCT_BY_KEY.get(dto.productKey)! : null;
    const productName = product?.label ?? dto.productName;
    const unit = product?.unit ?? dto.unit;
    if (!productName) throw new BadRequestException('Escolha um produto da lista ou informe o nome do produto.');
    if (!unit) throw new BadRequestException('Informe a unidade do preço (ex.: R$/kg, R$/@, R$/L).');
    const observedOn = parseDay(dto.observedOn, 'Data do preço');
    if (dto.observedOn > today()) throw new BadRequestException('A data do preço não pode ser no futuro.');

    const created = await this.prisma.localPrice.create({
      data: {
        productKey: product?.key ?? null,
        productName,
        unit,
        price: new Prisma.Decimal(dto.price),
        place: dto.place,
        observedOn,
        notes: dto.notes || null,
        createdById: user.id,
      } as Prisma.LocalPriceUncheckedCreateInput,
      include: { createdBy: { select: { id: true, name: true } } },
    });
    await this.audit.record({
      userId: user.id,
      action: 'LOCAL_PRICE_CREATED',
      entity: 'LocalPrice',
      entityId: created.id,
      details: { productKey: created.productKey, productName, unit, price: dto.price, place: dto.place, observedOn: dto.observedOn },
    });
    return this.localView(created);
  }

  // Exclusão lógica: a coordenação ou quem lançou.
  async removeLocal(id: string, user: AuthUser) {
    const current = await this.prisma.localPrice.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException('Preço não encontrado.');
    if (user.role !== Role.COORDINATION && current.createdById !== user.id) {
      throw new ForbiddenException('Só a coordenação ou quem lançou o preço pode excluí-lo.');
    }
    await this.prisma.localPrice.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.record({
      userId: user.id,
      action: 'LOCAL_PRICE_DELETED',
      entity: 'LocalPrice',
      entityId: id,
      details: { productName: current.productName, price: Number(current.price), place: current.place },
    });
    return { id, deleted: true };
  }

  private async importStatus() {
    const [lastSuccess, lastAttempt] = await Promise.all([
      this.prisma.marketPriceImport.findFirst({ where: { source: 'CONAB', status: { in: ['SUCCESS', 'NOT_MODIFIED'] } }, orderBy: { startedAt: 'desc' } }),
      this.prisma.marketPriceImport.findFirst({ where: { source: 'CONAB' }, orderBy: { startedAt: 'desc' } }),
    ]);
    return {
      lastSuccessAt: lastSuccess?.finishedAt ?? null,
      lastAttemptAt: lastAttempt?.finishedAt ?? null,
      lastError: lastAttempt?.status === 'FAILED' ? lastAttempt.error : null,
    };
  }

  private ufQuotes(product: TrackedProduct, rows: MarketPrice[]) {
    // Uma cotação por UF configurada (normalmente só o Pará), com a variação para a semana anterior.
    return this.config.ufs
      .map((uf) => {
        const [last, previous] = rows.filter((r) => r.uf === uf);
        return last ? this.quote(product, last, previous ?? null) : null;
      })
      .filter((q) => q !== null);
  }

  private quote(product: TrackedProduct, row: MarketPrice, previous: MarketPrice | null) {
    const value = convert(product, Number(row.value));
    const prev = previous ? convert(product, Number(previous.value)) : null;
    const stale = Date.now() - row.weekEnd.getTime() > this.config.staleDays * DAY;
    return {
      source: 'CONAB',
      scope: row.scope,
      place: row.placeName,
      weekStart: toDay(row.weekStart),
      weekEnd: toDay(row.weekEnd),
      value,
      unit: product.unit,
      previousValue: prev,
      changePct: prev ? Math.round(((value - prev) / prev) * 1000) / 10 : null,
      stale,
      warning: stale ? `Cotação desatualizada: o último dado da CONAB para ${row.placeName} é da semana até ${toDay(row.weekEnd)!.split('-').reverse().join('/')}.` : null,
    };
  }

  private localView(l: LocalWithAuthor) {
    return {
      id: l.id,
      source: 'LOCAL',
      productKey: l.productKey,
      productName: l.productName,
      unit: l.unit,
      price: Number(l.price),
      place: l.place,
      observedOn: toDay(l.observedOn),
      notes: l.notes,
      createdBy: l.createdBy,
      createdAt: l.createdAt,
    };
  }
}

// Linhas em ordem de semana decrescente: fica a mais recente de cada praça.
function latestByPlace(rows: MarketPrice[]) {
  const seen = new Map<string, MarketPrice>();
  for (const r of rows) if (!seen.has(r.placeKey)) seen.set(r.placeKey, r);
  return [...seen.values()].sort((a, b) => a.placeName.localeCompare(b.placeName));
}
