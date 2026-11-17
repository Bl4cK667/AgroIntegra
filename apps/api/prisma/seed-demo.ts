// Carga de dados FICTÍCIOS para a demonstração.
// Rodar: npm run demo:reset (na raiz). Apaga os dados de atendimento e recria tudo.
//
// - Sorteio com semente fixa: a mesma data gera sempre os mesmos dados.
// - Datas relativas ao dia da carga: o painel sempre tem visitas no mês atual.
// - Nomes, telefones (DDD 00) e comunidades são inventados. CPFs são gerados só para passar na validação.
import { EnrollmentStatus, Prisma, PrismaClient, RequestPriority, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { normalizeSearch } from '../src/common/search';
import { DEMO_PASSWORD, seedUsers } from './seed-users';

// ---------- Sorteio reproduzível ----------
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Dice {
  constructor(private readonly r: () => number) {}
  float = (min = 0, max = 1) => min + this.r() * (max - min);
  int = (min: number, max: number) => Math.floor(this.float(min, max + 1));
  pick = <T>(list: readonly T[]) => list[Math.floor(this.r() * list.length)];
  chance = (p: number) => this.r() < p;
  shuffle = <T>(list: readonly T[]) => {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
}

// ---------- Datas ----------
const DAY_MS = 86_400_000;
// Dia (coluna DATE) na meia-noite UTC.
const utcDay = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);
// Instante "no meio do expediente" de um dia, no fuso local.
const workTime = (day: Date, dice: Dice) =>
  new Date(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), dice.int(7, 16), dice.int(0, 59));

// CPF válido gerado a partir de um número (mesmo cálculo dos testes).
export function fakeCpf(seed: number): string {
  const base = String(100000000 + ((seed * 7919) % 899999999)).padStart(9, '0').split('').map(Number);
  const digit = (nums: number[]) => {
    const sum = nums.reduce((acc, n, i) => acc + n * (nums.length + 1 - i), 0);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  const d1 = digit(base);
  const d2 = digit([...base, d1]);
  return [...base, d1, d2].join('');
}

// ---------- Listas fictícias ----------
const FIRST = [
  'Antônia', 'Benedito', 'Cícero', 'Damiana', 'Edileuza', 'Francisco', 'Genival', 'Hilda', 'Iracema', 'Joaquim',
  'Josefa', 'Lindalva', 'Manoel', 'Marinalva', 'Nivaldo', 'Odete', 'Raimundo', 'Rita', 'Sebastião', 'Severina',
  'Terezinha', 'Valdemar', 'Zuleide', 'Adalberto', 'Cleonice', 'Expedito', 'Fátima', 'Gerusa', 'Jandira', 'Luzia',
  'Natanael', 'Osvaldo', 'Quitéria', 'Rosimeire', 'Valdeci', 'Zacarias', 'Aparecida', 'Djalma', 'Erivaldo', 'Socorro',
] as const;
const LAST = [
  'Alencar', 'Bezerra', 'Cavalcante', 'Diniz', 'Feitosa', 'Gonçalves', 'Holanda', 'Leite', 'Macedo', 'Nogueira',
  'Pereira', 'Queiroz', 'Rocha', 'Sampaio', 'Tavares', 'Uchôa', 'Vieira', 'Xavier', 'Brito', 'Coelho',
  'Duarte', 'Farias', 'Gadelha', 'Lacerda', 'Mendonça', 'Pinheiro', 'Sobreira', 'Teles', 'Vasconcelos', 'Moura',
] as const;

// Comunidades inventadas, com um ponto de referência para a localização das visitas.
const COMMUNITIES = [
  { name: 'Serra do Cedro', lat: -7.912, lng: -38.274 },
  { name: 'Riacho Verde', lat: -7.958, lng: -38.331 },
  { name: 'Baixio das Pedras', lat: -8.004, lng: -38.297 },
  { name: 'Lagoa Seca', lat: -7.881, lng: -38.352 },
  { name: 'Córrego Fundo', lat: -7.936, lng: -38.402 },
  { name: 'Açude Novo', lat: -8.031, lng: -38.366 },
  { name: 'Várzea Comprida', lat: -7.867, lng: -38.239 },
] as const;

const PROPERTY_NAMES = [
  'Sítio Boa Vista', 'Sítio Pedra Branca', 'Sítio Olho d’Água', 'Sítio Caiçara', 'Sítio Cajueiro', 'Sítio Juazeiro',
  'Sítio Umbuzeiro', 'Sítio Lajedo', 'Sítio São José', 'Sítio Santa Luzia', 'Fazendinha Mandacaru', 'Sítio Aroeira',
  'Sítio Baraúna', 'Sítio Catingueira', 'Sítio Jatobá', 'Sítio Pau-Ferro', 'Sítio Riachinho', 'Sítio Tamboril',
] as const;

interface Activity {
  name: string;
  diagnoses: string[];
  plans: string[];
  impacts: string[];
}

const ACTIVITIES: Activity[] = [
  {
    name: 'Bovinocultura de leite',
    diagnoses: [
      'Pastagem degradada e com invasoras; baixa oferta de forragem na seca.',
      'Queda na produção de leite; vacas com escore corporal baixo.',
      'Bebedouro com vazamento e água de má qualidade no curral.',
      'Casos de mastite no rebanho; ordenha sem higienização dos tetos.',
    ],
    plans: [
      'Divisão da área em piquetes e vedação do piquete mais degradado por 45 dias.',
      'Suplementação com silagem e palma no período seco; ajuste do sal mineral.',
      'Troca da boia do bebedouro e limpeza mensal do reservatório.',
      'Pré e pós-dipping na ordenha; teste da caneca a cada ordenha.',
    ],
    impacts: ['Mais leite por vaca na seca.', 'Menos perdas por mastite.', 'Rebanho em melhor condição corporal.'],
  },
  {
    name: 'Caprinocultura',
    diagnoses: [
      'Verminose no rebanho; animais com mucosa pálida.',
      'Aprisco com piso úmido e cerca danificada.',
      'Cabritos com baixo ganho de peso após o desmame.',
    ],
    plans: [
      'Vermifugação seletiva pelo método Famacha e rodízio de áreas.',
      'Reforma da cerca e elevação do piso do aprisco.',
      'Creep-feeding para os cabritos e separação por lote.',
    ],
    impacts: ['Menos mortes de cabritos.', 'Rebanho mais saudável e produtivo.'],
  },
  {
    name: 'Horticultura',
    diagnoses: [
      'Irrigação por mangueira com muito desperdício de água.',
      'Ataque de pulgão e mosca-branca nos canteiros de couve.',
      'Solo compactado e pobre em matéria orgânica.',
    ],
    plans: [
      'Instalação de gotejamento nos canteiros e irrigação no fim da tarde.',
      'Calda de fumo e sabão; plantio de coentro como bordadura.',
      'Adubação com esterco curtido e cobertura morta nos canteiros.',
    ],
    impacts: ['Economia de água na irrigação.', 'Hortaliças de melhor qualidade para a feira.'],
  },
  {
    name: 'Apicultura',
    diagnoses: ['Colmeias fracas e com pouca reserva de mel.', 'Caixas antigas com frestas e ataque de traça.'],
    plans: ['Alimentação de manutenção na seca e união de enxames fracos.', 'Troca das caixas danificadas e limpeza do apiário.'],
    impacts: ['Mais colmeias produtivas na próxima florada.'],
  },
  {
    name: 'Milho e feijão',
    diagnoses: [
      'Plantio sem análise de solo; produtividade baixa na última safra.',
      'Lagarta-do-cartucho no milho em fase inicial.',
      'Sementes guardadas sem proteção contra caruncho.',
    ],
    plans: [
      'Coleta de solo para análise e calagem antes das chuvas.',
      'Monitoramento semanal e controle biológico com Bacillus thuringiensis.',
      'Armazenamento das sementes em garrafas PET com cinza.',
    ],
    impacts: ['Mais grãos por hectare.', 'Sementes próprias garantidas para o próximo plantio.'],
  },
  {
    name: 'Avicultura caipira',
    diagnoses: ['Galinhas soltas sem abrigo; perdas para predadores.', 'Baixa postura e aves com piolho.'],
    plans: ['Construção de galinheiro simples com poleiro e ninhos.', 'Limpeza do galinheiro e banho de cinza para as aves.'],
    impacts: ['Mais ovos para consumo e venda.'],
  },
];

const REQUEST_SUBJECTS: Record<string, string[]> = {
  'Bovinocultura de leite': ['Orientação sobre silagem de milho', 'Vacas com queda na produção', 'Reforma de pastagem'],
  Caprinocultura: ['Cabras com verminose', 'Projeto de aprisco', 'Orientação sobre reprodução do rebanho'],
  Horticultura: ['Pragas na horta', 'Instalação de gotejamento', 'Adubação dos canteiros'],
  Apicultura: ['Enxames fracos na seca', 'Troca de caixas das colmeias'],
  'Milho e feijão': ['Análise de solo antes do plantio', 'Lagarta no milho', 'Armazenamento de sementes'],
  'Avicultura caipira': ['Galinheiro para as aves', 'Galinhas com baixa postura'],
};

// ---------- Programas ----------
interface ProgramPlan {
  name: string;
  description: string;
  slots: number;
  goalQuantity: number;
  unit: string;
  unitSingular: string;
  unitPriceCents: number;
  startMonth: number; // 0 a 11, ano corrente (negativo = ano anterior)
  startDay: number;
  months: number;
  enrolled: number;
  approved: number;
  rejected: number;
  deliveredShare: number; // fração dos aprovados que já receberam
  perDelivery: [number, number];
}

const PROGRAMS: ProgramPlan[] = [
  {
    name: 'Kits de irrigação por gotejamento',
    description: 'Kits de gotejamento para hortas e pomares familiares, com instalação acompanhada pelo técnico.',
    slots: 60, goalQuantity: 60, unit: 'kits', unitSingular: 'kit', unitPriceCents: 250_000,
    startMonth: 2, startDay: 1, months: 10, enrolled: 78, approved: 56, rejected: 9, deliveredShare: 0.72, perDelivery: [1, 1],
  },
  {
    name: 'Palma forrageira resistente',
    description: 'Raquetes de palma resistente à cochonilha para formar reserva de forragem na seca.',
    slots: 120, goalQuantity: 24_000, unit: 'raquetes', unitSingular: 'raquete', unitPriceCents: 200,
    startMonth: 1, startDay: 1, months: 10, enrolled: 112, approved: 100, rejected: 6, deliveredShare: 0.85, perDelivery: [150, 250],
  },
  {
    name: 'Quintais produtivos',
    description: 'Galinheiro, dez aves caipiras e orientação de manejo para cada família.',
    slots: 40, goalQuantity: 40, unit: 'kits', unitSingular: 'kit', unitPriceCents: 180_000,
    startMonth: 3, startDay: 1, months: 9, enrolled: 52, approved: 40, rejected: 7, deliveredShare: 0.65, perDelivery: [1, 1],
  },
  {
    name: 'Sementes crioulas',
    description: 'Sementes de milho e feijão da região, guardadas no banco comunitário.',
    slots: 200, goalQuantity: 400, unit: 'sacos', unitSingular: 'saco', unitPriceCents: 8_000,
    startMonth: 8, startDay: 1, months: 7, enrolled: 64, approved: 41, rejected: 3, deliveredShare: 0.45, perDelivery: [2, 2],
  },
];

// Produtora usada no roteiro da demonstração: tem histórico e uma solicitação urgente esperando visita.
export const DEMO_PRODUCER = {
  name: 'Maria das Graças Nogueira',
  community: 'Serra do Cedro',
  requestSubject: 'Cochonilha-do-carmim na palma',
};

const EXTRA_TECHNICIANS = [
  { name: 'Joana Prates Leal', email: 'tecnico2@agrointegra.demo' },
  { name: 'Caio Menezes Brandão', email: 'tecnico3@agrointegra.demo' },
];

// Apaga só os dados de atendimento; usuários são mantidos.
async function wipe(prisma: PrismaClient) {
  await prisma.auditLog.deleteMany();
  await prisma.visitPhoto.deleteMany();
  await prisma.visit.deleteMany();
  await prisma.serviceRequest.deleteMany();
  await prisma.delivery.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.program.deleteMany();
  await prisma.property.deleteMany();
  await prisma.producer.deleteMany();
}

export async function seedDemo(prisma: PrismaClient, now = new Date()) {
  const dice = new Dice(mulberry32(20261116));
  const year = now.getFullYear();
  const today = utcDay(year, now.getMonth(), now.getDate());
  // Horário de expediente, mas nunca depois de agora.
  const work = (day: Date) => new Date(Math.min(workTime(day, dice).getTime(), now.getTime()));

  await wipe(prisma);
  await seedUsers(prisma);
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  for (const t of EXTRA_TECHNICIANS) {
    const user = await prisma.user.upsert({
      where: { email: t.email },
      update: { name: t.name, role: Role.TECHNICIAN, active: true },
      create: { ...t, role: Role.TECHNICIAN, passwordHash: hash },
    });
    const organizationId = '00000000-0000-4000-8000-000000000001';
    await prisma.organizationMembership.upsert({
      where: { userId_organizationId: { userId: user.id, organizationId } },
      create: { userId: user.id, organizationId, role: Role.TECHNICIAN },
      update: { active: true, role: Role.TECHNICIAN },
    });
  }
  const coordination = await prisma.user.findUniqueOrThrow({ where: { email: 'coordenacao@agrointegra.demo' } });
  const technicians = await prisma.user.findMany({ where: { role: Role.TECHNICIAN, active: true }, orderBy: { email: 'asc' } });

  // ---------- Produtores e propriedades ----------
  const usedNames = new Set<string>([DEMO_PRODUCER.name]);
  const producerRows: Prisma.ProducerCreateManyInput[] = [];
  const activityOf = new Map<string, Activity>();
  const communityOf = new Map<string, (typeof COMMUNITIES)[number]>();
  const startOfData = utcDay(year - 1, 9, 1); // cadastros desde outubro do ano anterior

  const addProducer = (name: string, community: (typeof COMMUNITIES)[number], i: number, consent: boolean) => {
    const id = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
    const createdDay = addDays(startOfData, dice.int(0, Math.max(0, Math.round((today.getTime() - startOfData.getTime()) / DAY_MS) - 60)));
    const createdAt = work(createdDay);
    producerRows.push({
      id,
      name,
      searchName: normalizeSearch(name),
      cpf: fakeCpf(50_000 + i),
      phone: dice.chance(0.85) ? `(00) 9${dice.int(1000, 9999)}-${dice.int(1000, 9999)}` : null,
      community: community.name,
      consentAt: consent ? addDays(createdAt, dice.int(0, 3)) : null,
      createdById: dice.pick(technicians).id,
      createdAt,
    });
    activityOf.set(id, dice.pick(ACTIVITIES));
    communityOf.set(id, community);
    return id;
  };

  const demoId = addProducer(DEMO_PRODUCER.name, COMMUNITIES[0], 1, true);
  activityOf.set(demoId, ACTIVITIES[1]); // caprinocultura e palma
  const TOTAL_PRODUCERS = 140;
  for (let i = 2; i <= TOTAL_PRODUCERS; i++) {
    let name = '';
    do {
      name = `${dice.pick(FIRST)} ${dice.pick(LAST)} ${dice.pick(LAST)}`;
    } while (usedNames.has(name) || name.split(' ')[1] === name.split(' ')[2]);
    usedNames.add(name);
    // Comunidades com tamanhos diferentes, como na vida real.
    const community = COMMUNITIES[Math.min(COMMUNITIES.length - 1, Math.floor(Math.pow(dice.float(), 1.4) * COMMUNITIES.length))];
    addProducer(name, community, i, dice.chance(0.92));
  }
  await prisma.producer.createMany({ data: producerRows });

  const propertyRows: Prisma.PropertyCreateManyInput[] = [];
  const propertiesOf = new Map<string, string[]>();
  for (const p of producerRows) {
    const count = p.id === demoId ? 2 : dice.chance(0.18) ? 2 : 1;
    const names: string[] = dice.shuffle(PROPERTY_NAMES).slice(0, count);
    if (p.id === demoId) names.splice(0, 2, 'Sítio Pedra Branca', 'Roçado do Lajedo');
    const ids: string[] = [];
    names.forEach((name, k) => {
      const id = `00000000-0000-4000-9000-${String(propertyRows.length + 1).padStart(12, '0')}`;
      const locality = p.community;
      const areaHa = Math.round(Math.exp(dice.float(Math.log(1.5), Math.log(60))) * 100) / 100;
      propertyRows.push({
        id,
        producerId: p.id!,
        name,
        searchText: normalizeSearch(`${name} ${locality}`),
        areaHa: new Prisma.Decimal(p.id === demoId ? [18.4, 6.25][k] : areaHa),
        locality,
        mainActivity: k === 0 ? activityOf.get(p.id!)!.name : dice.pick(ACTIVITIES).name,
        createdById: p.createdById,
        createdAt: p.createdAt,
      });
      ids.push(id);
    });
    propertiesOf.set(p.id!, ids);
  }
  await prisma.property.createMany({ data: propertyRows });

  // ---------- Visitas ----------
  // Alguns produtores recebem mais visitas que outros; cerca de um quarto ainda não foi atendido no ano.
  const producerIds = producerRows.map((p) => p.id!);
  const served = dice.shuffle(producerIds.filter((id) => id !== demoId)).slice(0, Math.round(producerIds.length * 0.74));
  const weights = served.map(() => Math.pow(dice.float(), 2.2) + 0.15);
  const weightTotal = weights.reduce((a, b) => a + b, 0);
  const pickServed = () => {
    let x = dice.float(0, weightTotal);
    for (let i = 0; i < served.length; i++) {
      x -= weights[i];
      if (x <= 0) return served[i];
    }
    return served[served.length - 1];
  };

  interface VisitPlan {
    id: string;
    producerId: string;
    day: Date;
  }
  const visitRows: Prisma.VisitCreateManyInput[] = [];
  const visitPlans: VisitPlan[] = [];
  const makeVisit = (producerId: string, day: Date, text?: { diagnosis: string; actionPlan: string; impact?: string }) => {
    const activity = activityOf.get(producerId)!;
    const community = communityOf.get(producerId)!;
    const k = dice.int(0, activity.diagnoses.length - 1);
    const props = propertiesOf.get(producerId)!;
    const id = `00000000-0000-4000-a000-${String(visitRows.length + 1).padStart(12, '0')}`;
    const returnOn = dice.chance(0.6) ? addDays(day, dice.int(20, 60)) : null;
    const located = dice.chance(0.75);
    visitRows.push({
      id,
      producerId,
      propertyId: dice.chance(0.92) ? props[0] : (props[1] ?? null),
      technicianId: dice.pick(technicians).id,
      visitedOn: day,
      diagnosis: text?.diagnosis ?? activity.diagnoses[k],
      actionPlan: text?.actionPlan ?? activity.plans[Math.min(k, activity.plans.length - 1)],
      returnOn,
      impact: text?.impact ?? (dice.chance(0.5) ? dice.pick(activity.impacts) : null),
      latitude: located ? community.lat + dice.float(-0.02, 0.02) : null,
      longitude: located ? community.lng + dice.float(-0.02, 0.02) : null,
      locationAccuracy: located ? dice.int(6, 40) : null,
      createdAt: work(day),
    });
    visitPlans.push({ id, producerId, day });
    return id;
  };

  // Visitas do ano anterior (outubro a dezembro): aparecem no histórico, não contam no painel do ano.
  for (let m = 9; m <= 11; m++) {
    for (let n = dice.int(6, 10); n > 0; n--) makeVisit(pickServed(), utcDay(year - 1, m, dice.int(1, 28)));
  }
  // Ano corrente: o volume cresce ao longo dos meses; o mês atual é proporcional aos dias já passados.
  for (let m = 0; m <= now.getMonth(); m++) {
    const daysInMonth = new Date(Date.UTC(year, m + 1, 0)).getUTCDate();
    const lastDay = m === now.getMonth() ? now.getDate() : daysInMonth;
    let count = Math.round(13 + m * 1.7 + dice.int(-3, 3));
    if (m === now.getMonth()) count = Math.max(2, Math.round((count * lastDay) / daysInMonth));
    for (let n = 0; n < count; n++) {
      const day = utcDay(year, m, dice.int(1, lastDay));
      makeVisit(pickServed(), day);
    }
  }

  // Histórico da produtora do roteiro: três visitas no ano.
  const demoVisits = [
    {
      daysAgo: 150,
      diagnosis: 'Verminose no rebanho de cabras; animais com mucosa pálida.',
      actionPlan: 'Vermifugação seletiva pelo método Famacha e rodízio de áreas.',
      impact: 'Menos mortes de cabritos.',
    },
    {
      daysAgo: 95,
      diagnosis: 'Reserva de forragem insuficiente para a seca.',
      actionPlan: 'Inscrição no programa de palma forrageira e preparo da área de plantio.',
    },
    {
      daysAgo: 30,
      diagnosis: 'Palma plantada com bom pegamento; cerca do aprisco danificada.',
      actionPlan: 'Reforma da cerca e acompanhamento da palma a cada 30 dias.',
    },
  ];
  for (const v of demoVisits) {
    const day = addDays(today, -v.daysAgo);
    if (day.getUTCFullYear() === year) makeVisit(demoId, day, v);
  }

  // ---------- Solicitações ----------
  const requestRows: Prisma.ServiceRequestCreateManyInput[] = [];
  const visitLinks: { visitId: string; requestId: string }[] = [];
  const priorities: RequestPriority[] = ['HIGH', 'MEDIUM', 'MEDIUM', 'LOW'];
  const newRequest = (producerId: string, extra: Partial<Prisma.ServiceRequestCreateManyInput>) => {
    const activity = activityOf.get(producerId)!;
    const id = `00000000-0000-4000-b000-${String(requestRows.length + 1).padStart(12, '0')}`;
    requestRows.push({
      id,
      producerId,
      propertyId: propertiesOf.get(producerId)![0],
      subject: dice.pick(REQUEST_SUBJECTS[activity.name]),
      description: dice.chance(0.6) ? 'Pedido feito pelo produtor na secretaria.' : null,
      priority: dice.pick(priorities),
      status: 'NEW',
      createdById: dice.pick([coordination, ...technicians]).id,
      ...extra,
    });
    return id;
  };

  // Concluídas: atendidas por uma visita do ano (a solicitação nasce dias antes da visita).
  const thisYearVisits = visitPlans.filter((v) => v.day.getUTCFullYear() === year && v.producerId !== demoId);
  for (const v of dice.shuffle(thisYearVisits).slice(0, Math.round(thisYearVisits.length * 0.22))) {
    const opened = work(addDays(v.day, -dice.int(3, 20)));
    const completed = work(v.day);
    const requestId = newRequest(v.producerId, { status: 'DONE', createdAt: opened, completedAt: completed, scheduledFor: v.day });
    visitLinks.push({ visitId: v.id, requestId });
  }
  // Abertas: novas nos últimos dias, em análise e agendadas para os próximos dias.
  const openPool = dice.shuffle(producerIds.filter((id) => id !== demoId));
  let cursor = 0;
  for (let n = 0; n < 8; n++) {
    newRequest(openPool[cursor++], { status: 'NEW', createdAt: work(addDays(today, -dice.int(0, 9))) });
  }
  for (let n = 0; n < 6; n++) {
    newRequest(openPool[cursor++], { status: 'IN_REVIEW', createdAt: work(addDays(today, -dice.int(5, 25))) });
  }
  for (let n = 0; n < 7; n++) {
    newRequest(openPool[cursor++], {
      status: 'SCHEDULED',
      createdAt: work(addDays(today, -dice.int(8, 30))),
      scheduledFor: addDays(today, dice.int(1, 18)),
    });
  }
  // A solicitação do roteiro: urgente, na coluna Nova, aberta ontem.
  newRequest(demoId, {
    subject: DEMO_PRODUCER.requestSubject,
    description: 'Manchas brancas nas raquetes da palma plantada há quatro meses. A produtora teme perder a reserva da seca.',
    priority: 'HIGH',
    status: 'NEW',
    propertyId: propertiesOf.get(demoId)![0],
    createdAt: work(addDays(today, -1)),
    createdById: coordination.id,
  });
  await prisma.serviceRequest.createMany({ data: requestRows });
  const linkOf = new Map(visitLinks.map((l) => [l.visitId, l.requestId]));
  await prisma.visit.createMany({ data: visitRows.map((v) => ({ ...v, requestId: linkOf.get(v.id!) ?? null })) });

  // ---------- Programas, inscrições e entregas ----------
  for (const plan of PROGRAMS) {
    const startsOn = utcDay(year, plan.startMonth, plan.startDay);
    const endsOn = addDays(utcDay(year, plan.startMonth + plan.months, 1), -1);
    const program = await prisma.program.create({
      data: {
        name: plan.name,
        description: plan.description,
        slots: plan.slots,
        goalQuantity: plan.goalQuantity,
        unit: plan.unit,
        unitSingular: plan.unitSingular,
        budgetCents: plan.goalQuantity * plan.unitPriceCents,
        startsOn,
        endsOn,
      },
    });

    // Inscrições abrem 30 dias antes do início e nunca passam de hoje.
    const enrollFrom = addDays(startsOn, -30);
    const enrollTo = new Date(Math.min(addDays(startsOn, 60).getTime(), today.getTime()));
    if (enrollFrom > today) continue;
    const span = Math.max(0, Math.round((enrollTo.getTime() - enrollFrom.getTime()) / DAY_MS));

    let candidates = dice.shuffle(producerIds.filter((id) => id !== demoId));
    if (plan.name.startsWith('Palma')) candidates = [demoId, ...candidates];
    const chosen = candidates.slice(0, plan.enrolled);
    const statuses: EnrollmentStatus[] = chosen.map((_, i) =>
      i < plan.approved ? 'APPROVED' : i < plan.approved + plan.rejected ? 'REJECTED' : 'ENROLLED',
    );
    await prisma.enrollment.createMany({
      data: chosen.map((producerId, i) => ({
        programId: program.id,
        producerId,
        status: statuses[i],
        enrolledOn: addDays(enrollFrom, dice.int(0, span)),
      })),
    });

    // Entregas só para aprovados, entre o início do programa e hoje, sem passar da meta nem do orçamento.
    const deliverFrom = startsOn;
    const deliverTo = new Date(Math.min(endsOn.getTime(), today.getTime()));
    if (deliverFrom > deliverTo) continue;
    const deliverSpan = Math.round((deliverTo.getTime() - deliverFrom.getTime()) / DAY_MS);
    const approved = chosen.filter((_, i) => statuses[i] === 'APPROVED');
    const receivers = approved.slice(0, Math.round(approved.length * plan.deliveredShare));
    let delivered = 0;
    const deliveryRows: Prisma.DeliveryCreateManyInput[] = [];
    for (const producerId of receivers) {
      const quantity = Math.min(dice.int(plan.perDelivery[0], plan.perDelivery[1]), plan.goalQuantity - delivered);
      if (quantity <= 0) break;
      delivered += quantity;
      deliveryRows.push({
        programId: program.id,
        producerId,
        deliveredOn: producerId === demoId ? addDays(today, -60) : addDays(deliverFrom, dice.int(0, deliverSpan)),
        quantity: producerId === demoId ? 200 : quantity,
        valueCents: (producerId === demoId ? 200 : quantity) * plan.unitPriceCents,
        note: null,
      });
    }
    // Ajuste fino: a entrega da produtora do roteiro tem quantidade fixa; refaz o total se passou da meta.
    const total = deliveryRows.reduce((s, d) => s + d.quantity, 0);
    if (total > plan.goalQuantity) deliveryRows.pop();
    await prisma.delivery.createMany({ data: deliveryRows.filter((d) => (d.deliveredOn as Date) >= deliverFrom) });
  }

  await prisma.auditLog.create({
    data: { action: 'DEMO_SEED', entity: 'Database', details: { producers: producerRows.length, visits: visitRows.length } },
  });

  return {
    producers: producerRows.length,
    properties: propertyRows.length,
    visits: visitRows.length,
    requests: requestRows.length,
    programs: PROGRAMS.length,
  };
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedDemo(prisma)
    .then((r) =>
      console.log(
        `Dados da demo prontos: ${r.producers} produtores, ${r.properties} propriedades, ${r.visits} visitas, ${r.requests} solicitações, ${r.programs} programas.`,
      ),
    )
    .finally(() => prisma.$disconnect());
}
