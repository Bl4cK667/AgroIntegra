import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, makeCpf, resetData, tokenFor } from './fixtures';

describe('Programas (somente leitura)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let kitsId: string;
  let emptyId: string;
  const api = () => request(app.getHttpServer());
  const auth = () => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await resetData(prisma);
    token = await tokenFor(app, 'coordenacao@agrointegra.demo');
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'coordenacao@agrointegra.demo' } });

    const producers = await Promise.all(
      [0, 1, 2, 3, 4].map((i) =>
        prisma.producer.create({
          data: {
            name: `Produtor ${i}`,
            searchName: `produtor ${i}`,
            cpf: makeCpf(900 + i),
            community: i < 3 ? 'Riacho Verde' : 'Baixio',
            createdById: admin.id,
          },
        }),
      ),
    );

    const kits = await prisma.program.create({
      data: {
        name: 'Kits de irrigação por gotejamento',
        description: 'Kits para hortas familiares.',
        slots: 4,
        goalQuantity: 8,
        unit: 'kits',
        budgetCents: 2_000_000,
        startsOn: new Date('2026-03-01'),
        endsOn: new Date('2026-12-31'),
      },
    });
    kitsId = kits.id;
    const statuses = ['APPROVED', 'APPROVED', 'APPROVED', 'REJECTED', 'ENROLLED'] as const;
    await prisma.enrollment.createMany({
      data: producers.map((p, i) => ({ programId: kits.id, producerId: p.id, status: statuses[i], enrolledOn: new Date('2026-03-10') })),
    });
    await prisma.delivery.createMany({
      data: [
        { programId: kits.id, producerId: producers[0].id, deliveredOn: new Date('2026-04-02'), quantity: 2, valueCents: 450_000 },
        { programId: kits.id, producerId: producers[1].id, deliveredOn: new Date('2026-04-03'), quantity: 1, valueCents: 225_050 },
        { programId: kits.id, producerId: producers[2].id, deliveredOn: new Date('2026-05-20'), quantity: 2, valueCents: 450_000 },
      ],
    });

    emptyId = (
      await prisma.program.create({
        data: {
          name: 'Sementes crioulas',
          description: 'Distribuição de sementes.',
          slots: 30,
          goalQuantity: 0,
          unit: 'sacos',
          budgetCents: 0,
          startsOn: new Date('2026-08-01'),
          endsOn: new Date('2027-01-31'),
        },
      })
    ).id;
  });

  afterAll(() => app.close());

  it('exige login', async () => {
    await api().get('/programs').expect(401);
  });

  it('calcula vagas, inscritos, beneficiários, entregas e execução a partir do banco', async () => {
    const res = await api().get('/programs').set(auth()).expect(200);
    const kits = res.body.items.find((p: { id: string }) => p.id === kitsId);
    expect(kits).toMatchObject({
      slots: 4,
      enrolled: 5,
      approved: 3,
      rejected: 1,
      pending: 1,
      openSlots: 1,
      deliveryCount: 3,
      goalQuantity: 8,
      deliveredQuantity: 5,
      physicalPercent: 62.5, // 5 de 8
      budgetCents: 2_000_000,
      spentCents: 1_125_050,
      financialPercent: 56.3, // 11.250,50 de 20.000,00
    });

    // Confere com uma contagem independente, linha a linha.
    const [enrollments, deliveries] = await Promise.all([
      prisma.enrollment.findMany({ where: { programId: kitsId } }),
      prisma.delivery.findMany({ where: { programId: kitsId } }),
    ]);
    expect(kits.enrolled).toBe(enrollments.length);
    expect(kits.approved).toBe(enrollments.filter((e) => e.status === 'APPROVED').length);
    expect(kits.deliveredQuantity).toBe(deliveries.reduce((s, d) => s + d.quantity, 0));
    expect(kits.spentCents).toBe(deliveries.reduce((s, d) => s + d.valueCents, 0));
  });

  it('programa sem meta nem orçamento mostra zero, sem dividir por zero', async () => {
    const res = await api().get(`/programs/${emptyId}`).set(auth()).expect(200);
    expect(res.body).toMatchObject({ enrolled: 0, physicalPercent: 0, financialPercent: 0, openSlots: 30 });
  });

  it('detalhe lista inscrições e entregas sem CPF', async () => {
    const res = await api().get(`/programs/${kitsId}`).set(auth()).expect(200);
    expect(res.body.enrollments).toHaveLength(5);
    expect(res.body.deliveries).toHaveLength(3);
    expect(res.body.deliveryCount).toBe(3); // o número não é sobrescrito pela lista
    expect(res.body.deliveries[0]).toMatchObject({ deliveredOn: '2026-05-20', quantity: 2, valueCents: 450_000 });
    expect(JSON.stringify(res.body)).not.toMatch(/cpf/i);
  });

  it('não existe rota para criar ou alterar programa', async () => {
    await api().post('/programs').set(auth()).send({ name: 'x' }).expect(404);
    await api().patch(`/programs/${kitsId}`).set(auth()).send({ name: 'x' }).expect(404);
  });
});
