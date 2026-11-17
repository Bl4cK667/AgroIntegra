import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestDatabase } from './test-database';
import { createTestApp, makeCpf, resetData, tokenFor } from './fixtures';

// Imagens mínimas reais (PNG 1x1) e um "JPEG" com a assinatura de bytes correta.
const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const PNG = `data:image/png;base64,${PNG_B64}`;
const JPEG_BYTES = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 7)]);
const JPEG = `data:image/jpeg;base64,${JPEG_BYTES.toString('base64')}`;
const NOT_IMAGE = `data:image/png;base64,${Buffer.from('isto não é uma imagem').toString('base64')}`;

function isoDay(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

describe('Visitas', () => {
  let app: INestApplication;
  let prisma: TestDatabase;
  let tech: string;
  let producerId: string;
  let propertyId: string;
  let otherPropertyId: string;

  const api = () => request(app.getHttpServer());
  const auth = { get: () => ({ Authorization: `Bearer ${tech}` }) };

  const baseVisit = (extra: Record<string, unknown> = {}) => ({
    producerId,
    propertyId,
    visitedOn: isoDay(-2),
    diagnosis: 'Pastagem degradada e baixa produção de leite na seca.',
    actionPlan: 'Divisão de piquetes e adubação de cobertura no início das chuvas.',
    returnOn: isoDay(28),
    impact: 'Aumento esperado da produção de leite por vaca.',
    ...extra,
  });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(TestDatabase);
    await prisma.visitPhoto.deleteMany();
    await prisma.visit.deleteMany();
    await resetData(prisma);
    tech = await tokenFor(app, 'tecnico@agrointegra.demo');

    const p = await api()
      .post('/producers')
      .set(auth.get())
      .send({ name: 'Edite Furtado Campos', cpf: makeCpf(500), community: 'Riacho Verde', consent: true });
    producerId = p.body.id;
    const prop = await api()
      .post(`/producers/${producerId}/properties`)
      .set(auth.get())
      .send({ name: 'Sítio Riacho Verde', areaHa: 20, locality: 'Riacho Verde' });
    propertyId = prop.body.id;

    const other = await api()
      .post('/producers')
      .set(auth.get())
      .send({ name: 'Outro Produtor', cpf: makeCpf(501), community: 'Baixio' });
    const otherProp = await api()
      .post(`/producers/${other.body.id}/properties`)
      .set(auth.get())
      .send({ name: 'Sítio Alheio', areaHa: 3, locality: 'Baixio' });
    otherPropertyId = otherProp.body.id;
  });

  afterAll(() => app.close());

  it('exige login', async () => {
    await api().post('/visits').send(baseVisit()).expect(401);
    await api().get('/visits').expect(401);
  });

  describe('registro completo', () => {
    let visitId: string;
    let photoIds: string[];

    it('salva a visita com fotos, assinatura e localização', async () => {
      const res = await api()
        .post('/visits')
        .set(auth.get())
        .send(
          baseVisit({
            photos: [PNG, JPEG, PNG],
            signature: PNG,
            location: { latitude: -12.97, longitude: -38.5, accuracy: 15 },
          }),
        )
        .expect(201);

      visitId = res.body.id;
      photoIds = res.body.photos.map((p: { id: string }) => p.id);
      expect(res.body).toMatchObject({
        producer: { id: producerId, name: 'Edite Furtado Campos' },
        property: { id: propertyId, name: 'Sítio Riacho Verde' },
        technician: { name: 'Rafael Lins Moreira' },
        visitedOn: isoDay(-2),
        returnOn: isoDay(28),
        hasSignature: true,
        location: { latitude: -12.97, longitude: -38.5, accuracy: 15 },
      });
      expect(res.body.photos.map((p: { position: number; mimeType: string }) => [p.position, p.mimeType])).toEqual([
        [1, 'image/png'],
        [2, 'image/jpeg'],
        [3, 'image/png'],
      ]);
      // A resposta não carrega os bytes das imagens.
      expect(JSON.stringify(res.body)).not.toContain(PNG_B64);
    });

    it('a visita salva aparece na página do produtor', async () => {
      const res = await api().get(`/producers/${producerId}`).set(auth.get()).expect(200);
      expect(res.body.visits).toEqual([
        expect.objectContaining({
          id: visitId,
          visitedOn: isoDay(-2),
          returnOn: isoDay(28),
          property: { id: propertyId, name: 'Sítio Riacho Verde' },
          technician: { name: 'Rafael Lins Moreira' },
          photoCount: 3,
        }),
      ]);
    });

    it('abre a visita pelo id', async () => {
      const res = await api().get(`/visits/${visitId}`).set(auth.get()).expect(200);
      expect(res.body.diagnosis).toBe('Pastagem degradada e baixa produção de leite na seca.');
      expect(res.body.actionPlan).toContain('piquetes');
    });

    it('devolve cada foto com o tipo certo', async () => {
      const png = await api().get(`/visits/${visitId}/photos/${photoIds[0]}`).set(auth.get()).expect(200);
      expect(png.headers['content-type']).toBe('image/png');
      expect(Buffer.from(png.body).toString('base64')).toBe(PNG_B64);

      const jpg = await api().get(`/visits/${visitId}/photos/${photoIds[1]}`).set(auth.get()).expect(200);
      expect(jpg.headers['content-type']).toBe('image/jpeg');
      expect(Buffer.compare(Buffer.from(jpg.body), JPEG_BYTES)).toBe(0);
    });

    it('devolve a assinatura', async () => {
      const res = await api().get(`/visits/${visitId}/signature`).set(auth.get()).expect(200);
      expect(res.headers['content-type']).toBe('image/png');
    });

    it('fotos e assinatura também exigem login', async () => {
      await api().get(`/visits/${visitId}/photos/${photoIds[0]}`).expect(401);
      await api().get(`/visits/${visitId}/signature`).expect(401);
    });

    it('foto de outra visita não é servida por esta', async () => {
      const other = await api().post('/visits').set(auth.get()).send(baseVisit({ photos: [PNG] })).expect(201);
      await api().get(`/visits/${visitId}/photos/${other.body.photos[0].id}`).set(auth.get()).expect(404);
    });

    it('registra na auditoria quem salvou a visita', async () => {
      const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'VISIT_CREATED', entityId: visitId } });
      const user = await prisma.user.findUniqueOrThrow({ where: { email: 'tecnico@agrointegra.demo' } });
      expect(log.userId).toBe(user.id);
      expect(log.details).toMatchObject({ producerId, photos: 3, signature: true, location: true });
    });

    it('lista as visitas mais recentes primeiro', async () => {
      await api().post('/visits').set(auth.get()).send(baseVisit({ visitedOn: isoDay(0), returnOn: undefined })).expect(201);
      const res = await api().get('/visits').set(auth.get()).expect(200);
      const days = res.body.items.map((v: { visitedOn: string }) => v.visitedOn);
      expect(days).toEqual([...days].sort().reverse());
      expect(res.body.items[0].producer).toEqual({ id: producerId, name: 'Edite Furtado Campos' });
    });
  });

  describe('registro mínimo', () => {
    it('aceita sem propriedade, fotos, assinatura, localização e retorno', async () => {
      const res = await api()
        .post('/visits')
        .set(auth.get())
        .send({ producerId, visitedOn: isoDay(0), diagnosis: 'Orientação geral.', actionPlan: 'Retornar quando chover.' })
        .expect(201);
      expect(res.body).toMatchObject({ property: null, photos: [], hasSignature: false, location: null, returnOn: null });
      await api().get(`/visits/${res.body.id}/signature`).set(auth.get()).expect(404);
    });
  });

  describe('validações', () => {
    const expect400 = async (extra: Record<string, unknown>, text?: string) => {
      const res = await api().post('/visits').set(auth.get()).send(baseVisit(extra)).expect(400);
      if (text) expect(JSON.stringify(res.body.message)).toContain(text);
    };

    it('diagnóstico e plano de ação são obrigatórios', async () => {
      await expect400({ diagnosis: '  ' }, 'diagnóstico');
      await expect400({ actionPlan: '' }, 'plano de ação');
    });

    it('data da visita não pode ser no futuro', async () => {
      await expect400({ visitedOn: isoDay(1), returnOn: isoDay(30) }, 'futuro');
    });

    it('retorno não pode ser antes da visita', async () => {
      await expect400({ returnOn: isoDay(-5) }, 'retorno');
    });

    it('datas precisam ser válidas', async () => {
      await expect400({ visitedOn: '2026-02-30' });
      await expect400({ visitedOn: 'ontem' });
    });

    it('no máximo 3 fotos', async () => {
      await expect400({ photos: [PNG, PNG, PNG, PNG] }, '3 fotos');
    });

    it('recusa arquivo que não é imagem, mesmo com nome de imagem', async () => {
      await expect400({ photos: [NOT_IMAGE] }, 'imagem');
      await expect400({ signature: NOT_IMAGE }, 'imagem');
    });

    it('recusa foto acima de 2 MB', async () => {
      const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(2 * 1024 * 1024 + 10)]);
      await expect400({ photos: [`data:image/jpeg;base64,${big.toString('base64')}`] }, '2 MB');
    });

    it('recusa propriedade de outro produtor', async () => {
      await expect400({ propertyId: otherPropertyId }, 'propriedade');
    });

    it('recusa coordenadas impossíveis', async () => {
      await expect400({ location: { latitude: 120, longitude: 0 } });
      await expect400({ location: { latitude: 0, longitude: -200 } });
    });

    it('produtor inexistente dá 404', async () => {
      await api()
        .post('/visits')
        .set(auth.get())
        .send(baseVisit({ producerId: randomUUID(), propertyId: undefined }))
        .expect(404);
    });

    it('nenhuma visita inválida foi gravada', async () => {
      const count = await prisma.visit.count({ where: { diagnosis: { contains: 'Pastagem' }, visitedOn: new Date(isoDay(1)) } });
      expect(count).toBe(0);
    });
  });
});
