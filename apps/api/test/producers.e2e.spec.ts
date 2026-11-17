import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, makeCpf, resetData, tokenFor } from './fixtures';

describe('Produtores e propriedades', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tech: string;
  let coord: string;

  const api = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  const newProducer = (seed: number, extra: Record<string, unknown> = {}) => ({
    name: 'Produtor Fictício',
    cpf: makeCpf(seed),
    phone: '(00) 90000-0000',
    community: 'Córrego Fundo',
    consent: false,
    ...extra,
  });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await resetData(prisma);
    tech = await tokenFor(app, 'tecnico@agrointegra.demo');
    coord = await tokenFor(app, 'coordenacao@agrointegra.demo');
  });

  afterAll(() => app.close());

  describe('cadastro de produtor', () => {
    it('exige login', async () => {
      await api().get('/producers').expect(401);
      await api().post('/producers').send(newProducer(1)).expect(401);
    });

    it('técnico cadastra produtor; a resposta traz o CPF mascarado', async () => {
      const cpf = makeCpf(10);
      const res = await api()
        .post('/producers')
        .set(auth(tech))
        .send(newProducer(10, { name: 'José da Conceição Ribeiro', cpf: cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') }))
        .expect(201);

      expect(res.body.cpf).toBe(`***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`);
      expect(JSON.stringify(res.body)).not.toContain(cpf);
      expect(res.body.consentAt).toBeNull();

      const saved = await prisma.producer.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(saved.cpf).toBe(cpf);
      expect(saved.searchName).toBe('jose da conceicao ribeiro');
    });

    it('com consentimento marcado, grava a data do consentimento', async () => {
      const before = Date.now();
      const res = await api().post('/producers').set(auth(coord)).send(newProducer(11, { consent: true })).expect(201);
      const consentAt = new Date(res.body.consentAt).getTime();
      expect(consentAt).toBeGreaterThanOrEqual(before - 1000);
      expect(consentAt).toBeLessThanOrEqual(Date.now() + 1000);
    });

    it('recusa CPF inválido', async () => {
      const res = await api().post('/producers').set(auth(tech)).send(newProducer(12, { cpf: '529.982.247-24' })).expect(400);
      expect(JSON.stringify(res.body.message)).toContain('CPF inválido');
    });

    it('recusa CPF já cadastrado', async () => {
      await api().post('/producers').set(auth(tech)).send(newProducer(13)).expect(201);
      const res = await api().post('/producers').set(auth(tech)).send(newProducer(13, { name: 'Outro' })).expect(409);
      expect(res.body.message).toBe('Já existe um produtor com este CPF.');
    });

    it('recusa nome e comunidade vazios', async () => {
      await api().post('/producers').set(auth(tech)).send(newProducer(14, { name: '  ', community: '' })).expect(400);
    });

    it('registra o cadastro na auditoria, sem o CPF completo', async () => {
      const res = await api().post('/producers').set(auth(tech)).send(newProducer(15)).expect(201);
      const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'PRODUCER_CREATED', entityId: res.body.id } });
      const user = await prisma.user.findUniqueOrThrow({ where: { email: 'tecnico@agrointegra.demo' } });
      expect(log.userId).toBe(user.id);
      expect(JSON.stringify(log.details ?? {})).not.toContain(makeCpf(15));
    });
  });

  describe('busca e listagem', () => {
    beforeAll(async () => {
      await api().post('/producers').set(auth(tech)).send(newProducer(20, { name: 'Antônia Saraiva Prado', community: 'Lagoa Seca' }));
      await api().post('/producers').set(auth(tech)).send(newProducer(21, { name: 'Benedito Assunção Neves', community: 'Serra Azul' }));
    });

    it('encontra pelo nome sem acento e sem diferenciar maiúsculas', async () => {
      const res = await api().get('/producers').query({ search: 'ANTONIA' }).set(auth(tech)).expect(200);
      expect(res.body.items.map((p: { name: string }) => p.name)).toEqual(['Antônia Saraiva Prado']);
    });

    it('encontra por parte do nome', async () => {
      const res = await api().get('/producers').query({ search: 'assuncao' }).set(auth(tech)).expect(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].name).toBe('Benedito Assunção Neves');
    });

    it('encontra com palavras soltas, em qualquer ordem', async () => {
      for (const search of ['antonia prado', 'prado antonia']) {
        const res = await api().get('/producers').query({ search }).set(auth(tech)).expect(200);
        expect(res.body.items.map((p: { name: string }) => p.name)).toEqual(['Antônia Saraiva Prado']);
      }
    });

    it('encontra pelo CPF completo, com ou sem pontuação', async () => {
      const cpf = makeCpf(21);
      const formatted = cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
      for (const search of [cpf, formatted]) {
        const res = await api().get('/producers').query({ search }).set(auth(tech)).expect(200);
        expect(res.body.items.map((p: { name: string }) => p.name)).toEqual(['Benedito Assunção Neves']);
      }
    });

    it('a listagem nunca devolve CPF completo', async () => {
      const res = await api().get('/producers').set(auth(tech)).expect(200);
      expect(res.body.total).toBeGreaterThanOrEqual(2);
      const body = JSON.stringify(res.body);
      const all = await prisma.producer.findMany({ select: { cpf: true } });
      for (const { cpf } of all) expect(body).not.toContain(cpf);
      for (const p of res.body.items) expect(p.cpf).toMatch(/^\*\*\*\.\d{3}\.\d{3}-\*\*$/);
    });

    it('lista em ordem alfabética e informa o total', async () => {
      const res = await api().get('/producers').set(auth(tech)).expect(200);
      const names = res.body.items.map((p: { name: string }) => p.name);
      expect(names).toEqual([...names].sort((a: string, b: string) => a.localeCompare(b, 'pt-BR')));
      expect(res.body.total).toBe(await prisma.producer.count());
    });

    it('busca sem resultado devolve lista vazia', async () => {
      const res = await api().get('/producers').query({ search: 'zzzz inexistente' }).set(auth(tech)).expect(200);
      expect(res.body).toEqual({ items: [], total: 0 });
    });
  });

  describe('página do produtor, edição e consentimento', () => {
    let id: string;

    beforeAll(async () => {
      const res = await api().post('/producers').set(auth(tech)).send(newProducer(30, { name: 'Cícero Bandeira Lopes' }));
      id = res.body.id;
    });

    it('mostra o produtor com CPF mascarado e lista de propriedades', async () => {
      const res = await api().get(`/producers/${id}`).set(auth(tech)).expect(200);
      expect(res.body).toMatchObject({ id, name: 'Cícero Bandeira Lopes', properties: [] });
      expect(res.body.cpf).toMatch(/^\*\*\*\./);
      expect(res.body.createdBy).toEqual({ name: 'Rafael Lins Moreira' });
    });

    it('produtor inexistente dá 404', async () => {
      await api().get('/producers/00000000-0000-0000-0000-000000000000').set(auth(tech)).expect(404);
    });

    it('edita nome, telefone e comunidade, mas não o CPF', async () => {
      const res = await api()
        .patch(`/producers/${id}`)
        .set(auth(tech))
        .send({ name: 'Cícero Bandeira Lopes Filho', community: 'Baixio' })
        .expect(200);
      expect(res.body).toMatchObject({ name: 'Cícero Bandeira Lopes Filho', community: 'Baixio' });
      const saved = await prisma.producer.findUniqueOrThrow({ where: { id } });
      expect(saved.searchName).toBe('cicero bandeira lopes filho');

      await api().patch(`/producers/${id}`).set(auth(tech)).send({ cpf: makeCpf(99) }).expect(400);
    });

    it('registra o consentimento depois, uma única vez', async () => {
      const res = await api().post(`/producers/${id}/consent`).set(auth(tech)).expect(201);
      expect(res.body.consentAt).toEqual(expect.any(String));
      const again = await api().post(`/producers/${id}/consent`).set(auth(tech)).expect(201);
      expect(again.body.consentAt).toBe(res.body.consentAt);

      const logs = await prisma.auditLog.count({ where: { action: 'PRODUCER_CONSENT', entityId: id } });
      expect(logs).toBe(1);
    });
  });

  describe('propriedades', () => {
    let producerId: string;

    beforeAll(async () => {
      const res = await api().post('/producers').set(auth(tech)).send(newProducer(40, { name: 'Dalva Moreira Teles' }));
      producerId = res.body.id;
    });

    it('cadastra propriedade com área digitada', async () => {
      const res = await api()
        .post(`/producers/${producerId}/properties`)
        .set(auth(tech))
        .send({ name: 'Sítio Boa Esperança', areaHa: 12.5, locality: 'Córrego Fundo', mainActivity: 'Bovinocultura de leite' })
        .expect(201);
      expect(res.body).toMatchObject({ name: 'Sítio Boa Esperança', areaHa: 12.5, producerId });
    });

    it('a propriedade aparece na página do produtor', async () => {
      const res = await api().get(`/producers/${producerId}`).set(auth(tech)).expect(200);
      expect(res.body.properties).toHaveLength(1);
      expect(res.body.properties[0]).toMatchObject({ name: 'Sítio Boa Esperança', areaHa: 12.5 });
    });

    it('recusa área zero, negativa ou com mais de 2 casas', async () => {
      for (const areaHa of [0, -3, 1.234]) {
        await api()
          .post(`/producers/${producerId}/properties`)
          .set(auth(tech))
          .send({ name: 'X', areaHa, locality: 'Y' })
          .expect(400);
      }
    });

    it('recusa propriedade para produtor inexistente', async () => {
      await api()
        .post('/producers/00000000-0000-0000-0000-000000000000/properties')
        .set(auth(tech))
        .send({ name: 'X', areaHa: 1, locality: 'Y' })
        .expect(404);
    });

    it('lista de propriedades traz o produtor, sem CPF', async () => {
      const res = await api().get('/properties').query({ search: 'boa esperanca' }).set(auth(tech)).expect(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0]).toMatchObject({
        name: 'Sítio Boa Esperança',
        areaHa: 12.5,
        producer: { id: producerId, name: 'Dalva Moreira Teles' },
      });
      expect(res.body.items[0].producer.cpf).toBeUndefined();
    });

    it('busca de propriedades também encontra pelo nome do produtor', async () => {
      const res = await api().get('/properties').query({ search: 'dalva' }).set(auth(tech)).expect(200);
      expect(res.body.items).toHaveLength(1);
    });

    it('busca de propriedades combina palavras do produtor e da propriedade', async () => {
      const res = await api().get('/properties').query({ search: 'dalva esperanca' }).set(auth(tech)).expect(200);
      expect(res.body.items).toHaveLength(1);
    });

    it('edita a área e registra na auditoria', async () => {
      const { body } = await api().get('/properties').query({ search: 'boa esperanca' }).set(auth(tech));
      const propId = body.items[0].id;
      const res = await api().patch(`/properties/${propId}`).set(auth(coord)).send({ areaHa: 14 }).expect(200);
      expect(res.body.areaHa).toBe(14);
      const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'PROPERTY_UPDATED', entityId: propId } });
      expect(log.details).toMatchObject({ changed: ['areaHa'] });
    });

    describe('localização', () => {
      const location = {
        address: 'Estrada Vicinal do Açude, km 4',
        city: 'Vale do Mandacaru',
        state: 'pe',
        coordinates: { latitude: -8.123456, longitude: -36.654321 },
      };

      it('cadastra endereço, município, UF e coordenadas; aparece na página do produtor', async () => {
        const created = await api()
          .post(`/producers/${producerId}/properties`)
          .set(auth(tech))
          .send({ name: 'Fazenda Lajedo Alto', areaHa: 30, locality: 'Serra Branca', ...location })
          .expect(201);
        expect(created.body).toMatchObject({ ...location, state: 'PE' });

        const res = await api().get(`/producers/${producerId}`).set(auth(tech)).expect(200);
        const prop = res.body.properties.find((p: { id: string }) => p.id === created.body.id);
        expect(prop).toMatchObject({ ...location, state: 'PE' });
      });

      it('sem localização, os campos ficam vazios', async () => {
        const res = await api().get(`/producers/${producerId}`).set(auth(tech)).expect(200);
        const prop = res.body.properties.find((p: { name: string }) => p.name === 'Sítio Boa Esperança');
        expect(prop).toMatchObject({ address: null, city: null, state: null, coordinates: null });
      });

      it('busca de propriedades encontra pelo município, sem acento', async () => {
        const res = await api().get('/properties').query({ search: 'mandacaru lajedo' }).set(auth(tech)).expect(200);
        expect(res.body.items).toHaveLength(1);
        expect(res.body.items[0]).toMatchObject({ name: 'Fazenda Lajedo Alto', city: 'Vale do Mandacaru', state: 'PE' });
      });

      it('recusa UF inexistente e coordenadas fora da faixa', async () => {
        const base = { name: 'X', areaHa: 1, locality: 'Y' };
        const invalid = [
          { state: 'XX' },
          { coordinates: { latitude: 91, longitude: 0 } },
          { coordinates: { latitude: 0, longitude: -181 } },
          { coordinates: { latitude: -8.1 } },
        ];
        for (const extra of invalid) {
          await api()
            .post(`/producers/${producerId}/properties`)
            .set(auth(tech))
            .send({ ...base, ...extra })
            .expect(400);
        }
      });

      it('edita a localização, apaga com valor vazio e registra na auditoria', async () => {
        const { body } = await api().get('/properties').query({ search: 'lajedo' }).set(auth(tech));
        const propId = body.items[0].id;

        const moved = await api()
          .patch(`/properties/${propId}`)
          .set(auth(coord))
          .send({ coordinates: { latitude: -8.2, longitude: -36.7 }, address: '' })
          .expect(200);
        expect(moved.body).toMatchObject({
          coordinates: { latitude: -8.2, longitude: -36.7 },
          address: null,
          city: 'Vale do Mandacaru',
          state: 'PE',
        });

        const cleared = await api().patch(`/properties/${propId}`).set(auth(coord)).send({ coordinates: null }).expect(200);
        expect(cleared.body.coordinates).toBeNull();

        const logs = await prisma.auditLog.findMany({
          where: { action: 'PROPERTY_UPDATED', entityId: propId },
          orderBy: { createdAt: 'asc' },
        });
        expect(logs.map((l) => l.details)).toEqual([
          { changed: ['address', 'coordinates'] },
          { changed: ['coordinates'] },
        ]);
      });
    });
  });
});
