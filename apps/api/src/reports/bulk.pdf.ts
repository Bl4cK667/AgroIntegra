import { existsSync } from 'node:fs';
import { join } from 'node:path';
import PDFDocument from 'pdfkit';

// Relatório em massa: tabela em A4 paisagem, cabeçalho da tabela repetido em cada página.

export interface BulkColumn {
  label: string;
  /** largura relativa (as colunas dividem a largura útil na proporção destes valores) */
  width: number;
  align?: 'left' | 'right' | 'center';
  /** false = só na planilha (texto longo demais para a tabela do PDF) */
  pdf?: boolean;
}

const C = {
  mata: '#1f5a3d',
  tinta: '#18211c',
  sutil: '#55605a',
  linha: '#d5d9d6',
  faixa: '#f0f2f1',
  zebra: '#f8f9f8',
};

const LOGO = join(__dirname, '..', '..', 'assets', 'agrointegra-logo.png');

const instantTime = (d: Date) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);

export function renderBulkTable(input: {
  title: string;
  filters: string;
  columns: BulkColumn[];
  rows: string[][];
  total: number;
  generatedBy: string;
  generatedAt: Date;
}): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margins: { top: 36, bottom: 50, left: 36, right: 36 },
    bufferPages: true,
    info: { Title: input.title, Author: 'AgroIntegra' },
  });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  const bottomLimit = () => doc.page.height - doc.page.margins.bottom;
  const totalWeight = input.columns.reduce((sum, c) => sum + c.width, 0);
  const widths = input.columns.map((c) => (c.width / totalWeight) * width);
  const PAD_X = 4;
  const PAD_Y = 3;
  const FONT = 7.5;

  // ---------- Cabeçalho da primeira página ----------
  if (existsSync(LOGO)) doc.image(LOGO, left, 30, { width: 70 });
  doc.font('Helvetica-Bold').fontSize(15).fillColor(C.tinta).text(input.title, left + 90, 36, { width: width - 90, align: 'right' });
  doc.font('Helvetica').fontSize(9).fillColor(C.sutil).text(input.filters, left + 90, doc.y + 3, { width: width - 90, align: 'right' });
  doc.text(`Total: ${input.total.toLocaleString('pt-BR')} ${input.total === 1 ? 'registro' : 'registros'}`, left + 90, doc.y + 2, {
    width: width - 90,
    align: 'right',
  });
  doc.y = Math.max(doc.y + 8, 96);
  doc.moveTo(left, doc.y).lineTo(left + width, doc.y).lineWidth(1.5).strokeColor(C.mata).stroke();
  doc.y += 8;

  const rowHeight = (cells: string[], bold: boolean) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(FONT);
    return (
      Math.max(...cells.map((text, i) => doc.heightOfString(text || ' ', { width: widths[i] - PAD_X * 2 }))) + PAD_Y * 2
    );
  };

  const drawRow = (cells: string[], y: number, h: number, kind: 'head' | 'body', zebra: boolean) => {
    if (kind === 'head') doc.rect(left, y, width, h).fill(C.faixa);
    else if (zebra) doc.rect(left, y, width, h).fill(C.zebra);
    let x = left;
    cells.forEach((text, i) => {
      doc
        .font(kind === 'head' ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(FONT)
        .fillColor(C.tinta)
        .text(text, x + PAD_X, y + PAD_Y, { width: widths[i] - PAD_X * 2, align: input.columns[i].align ?? 'left' });
      x += widths[i];
    });
    doc.moveTo(left, y + h).lineTo(left + width, y + h).lineWidth(0.5).strokeColor(C.linha).stroke();
  };

  const header = input.columns.map((c) => c.label);
  const headHeight = rowHeight(header, true);
  const drawHeader = () => {
    drawRow(header, doc.y, headHeight, 'head', false);
    doc.y += headHeight;
  };

  // Texto muito longo numa célula estouraria a página: no PDF ele é cortado (a planilha traz o texto inteiro).
  const MAX_CELL = 500;
  const clip = (text: string) => (text.length > MAX_CELL ? `${text.slice(0, MAX_CELL - 1)}…` : text);

  drawHeader();
  if (input.rows.length === 0) {
    doc.font('Helvetica-Oblique').fontSize(9).fillColor(C.sutil).text('Nenhum registro encontrado com estes filtros.', left, doc.y + 8);
  }
  input.rows.forEach((raw, index) => {
    const row = raw.map(clip);
    const h = rowHeight(row, false);
    if (doc.y + h > bottomLimit()) {
      doc.addPage();
      doc.y = doc.page.margins.top;
      drawHeader();
    }
    drawRow(row, doc.y, h, 'body', index % 2 === 1);
    doc.y += h;
  });

  // ---------- Rodapé em todas as páginas ----------
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const fy = doc.page.height - 34;
    doc.page.margins.bottom = 0;
    doc.moveTo(left, fy - 6).lineTo(left + width, fy - 6).lineWidth(0.5).strokeColor(C.linha).stroke();
    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor(C.sutil)
      .text(`AgroIntegra  ·  ${input.title}  ·  Gerado em ${instantTime(input.generatedAt)} por ${input.generatedBy}`, left, fy, {
        width: width - 90,
        lineBreak: false,
      })
      .text(`Página ${i + 1} de ${range.count}`, left + width - 90, fy, { width: 90, align: 'right', lineBreak: false });
  }

  doc.end();
  return done;
}
