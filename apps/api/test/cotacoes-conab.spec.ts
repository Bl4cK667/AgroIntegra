import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExternalSourceError } from '../src/common/external-http';
import { decodeConab, municipalityName, parseConabFile, parseWeek } from '../src/cotacoes/conab-file';
import { cotacoesConfigFromEnv } from '../src/cotacoes/cotacoes.config';
import { convert, PRODUCT_BY_KEY } from '../src/cotacoes/products';

// Trechos reais dos arquivos semanais da CONAB (18/11/2026), em Latin-1 como vêm do portal.
const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', 'cotacoes', name));
const PA = new Set(['PA']);

describe('Cotações: arquivo semanal da CONAB por UF', () => {
  const { rows, skipped } = parseConabFile(fixture('conab-semanal-uf.txt'), 'UF', PA);

  it('fica só o preço recebido pelo produtor da UF configurada (sem varejo, sem outra UF)', () => {
    expect(rows).toHaveLength(6);
    expect(skipped).toBe(0);
    expect(new Set(rows.map((r) => r.productName))).toEqual(new Set(['BOI', 'LEITE DE VACA']));
  });

  it('lê acentos (Latin-1), datas da semana, vírgula decimal e o nome da UF', () => {
    const boi = rows.find((r) => r.productName === 'BOI' && r.weekEnd === '2026-11-13')!;
    expect(boi).toEqual({
      productCode: '4193',
      productName: 'BOI',
      productClass: 'GORDO',
      scope: 'STATE',
      uf: 'PA',
      ibgeCode: null,
      placeKey: 'PA',
      placeName: 'Pará',
      weekStart: '2026-11-09',
      weekEnd: '2026-11-13',
      value: 25.22,
    });
  });

  it('a decodificação percebe que o arquivo não é UTF-8, apesar do cabeçalho HTTP', () => {
    expect(decodeConab(fixture('conab-semanal-uf.txt'))).toContain('PREÇO RECEBIDO');
    expect(decodeConab(Buffer.from('PREÇO', 'utf8'))).toBe('PREÇO');
  });

  it('colunas diferentes (formato mudou) viram erro claro, sem importar nada', () => {
    expect(() => parseConabFile(Buffer.from('a;b;c\n1;2;3\n'), 'UF', PA)).toThrow(ExternalSourceError);
    expect(() => parseConabFile(Buffer.from('a;b;c\n1;2;3\n'), 'UF', PA)).toThrow('formato inesperado');
  });

  it('linha com valor ou semana inválidos é descartada e contada', () => {
    const header = 'produto;classificao_produto;id_produto;uf;regiao;ano;mes;data_inicial_final_semana;semana;dsc_nivel_comercializacao;valor_produto_kg';
    const text = [header, 'BOI;GORDO;4193;PA;NORTE;2026;11;09-11-2026 - 13-11-2026;2;PREÇO RECEBIDO P/ PR;', 'BOI;GORDO;4193;PA;NORTE;2026;11;semana;2;PREÇO RECEBIDO P/ PR;25,0'].join('\n');
    expect(parseConabFile(Buffer.from(text, 'latin1'), 'UF', PA)).toEqual({ rows: [], skipped: 2 });
  });
});

describe('Cotações: arquivo semanal da CONAB por município', () => {
  const { rows } = parseConabFile(fixture('conab-semanal-municipio.txt'), 'MUNICIPIO', PA);

  it('praça municipal com código IBGE e nome legível', () => {
    expect(rows).toHaveLength(3);
    const maraba = rows.find((r) => r.weekEnd === '2025-11-21')!;
    expect(maraba).toMatchObject({ scope: 'MUNICIPALITY', ibgeCode: '1504208', placeKey: '1504208', placeName: 'Marabá/PA', value: 20.33 });
    expect(rows.find((r) => r.ibgeCode === '1507151')!.placeName).toBe('São Domingos do Araguaia/PA');
  });

  it('nomes de município: preposições em minúsculas e hífen preservado', () => {
    expect(municipalityName('IGARAPÉ-MIRI-PA', 'PA')).toBe('Igarapé-Miri/PA');
    expect(municipalityName('SANTA MARIA DAS BARREIRAS-PA', 'PA')).toBe('Santa Maria das Barreiras/PA');
  });

  it('semana "DD-MM-AAAA - DD-MM-AAAA"', () => {
    expect(parseWeek('29-12-2025 - 02-01-2026')).toEqual(['2025-12-29', '2026-01-02']);
    expect(parseWeek('ontem')).toBeNull();
  });
});

describe('Cotações: unidades do campo e configuração', () => {
  it('boi em R$/@ (×15), milho em saca de 60 kg, mandioca em R$/t', () => {
    expect(convert(PRODUCT_BY_KEY.get('BOI_GORDO')!, 25.22)).toBe(378.3);
    expect(convert(PRODUCT_BY_KEY.get('MILHO')!, 1.0)).toBe(60);
    expect(convert(PRODUCT_BY_KEY.get('MANDIOCA')!, 0.9)).toBe(900);
    expect(convert(PRODUCT_BY_KEY.get('LEITE')!, 2.35)).toBe(2.35);
  });

  it('UFs do .env, padrão PA; agendamento pode ser desligado', () => {
    expect(cotacoesConfigFromEnv({}).ufs).toEqual(['PA']);
    expect(cotacoesConfigFromEnv({ COTACOES_UFS: 'pa, to ,X' }).ufs).toEqual(['PA', 'TO']);
    expect(cotacoesConfigFromEnv({ COTACOES_SCHEDULE_ENABLED: 'false' }).scheduleEnabled).toBe(false);
  });
});
