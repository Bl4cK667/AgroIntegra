import { csvCell, toCsv } from '../src/reports/csv';

describe('Planilha CSV dos relatórios', () => {
  it('começa com BOM, usa ";" e CRLF', () => {
    const csv = toCsv(['Nome', 'Área (ha)'], [['Sítio Boa Vista', '12,50']]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.slice(1)).toBe('Nome;Área (ha)\r\nSítio Boa Vista;12,50\r\n');
  });

  it('coloca entre aspas o texto com ";", aspas ou quebra de linha', () => {
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('diz "sim"')).toBe('"diz ""sim"""');
    expect(csvCell('linha 1\nlinha 2')).toBe('"linha 1\nlinha 2"');
  });

  it('neutraliza texto que o Excel leria como fórmula', () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvCell('+55 91')).toBe("'+55 91");
    expect(csvCell('-1')).toBe("'-1");
    expect(csvCell('@soma')).toBe("'@soma");
  });

  it('número e vazio', () => {
    expect(csvCell(3)).toBe('3');
    expect(csvCell(-3)).toBe('-3'); // número de verdade não é fórmula
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });
});
