import { existsSync } from 'node:fs';
import { join } from 'node:path';
import PDFDocument from 'pdfkit';
import type { ProducerReport } from './reports.service';

// Cores da marca (mesmas do painel web).
const C = {
  mata: '#1f3a2c',
  terra: '#7a4b2a',
  tinta: '#18211c',
  sutil: '#5b675f',
  linha: '#d8dcd4',
  fundo: '#f2f3ef',
};

const LOGO = join(__dirname, '..', '..', 'assets', 'agrointegra-logo.png');

const PRIORITY: Record<string, string> = { HIGH: 'Alta', MEDIUM: 'Média', LOW: 'Baixa' };
const STATUS: Record<string, string> = { NEW: 'Nova', IN_REVIEW: 'Em análise', SCHEDULED: 'Agendada', DONE: 'Concluída' };
const ENROLLMENT: Record<string, string> = { ENROLLED: 'Inscrito', APPROVED: 'Beneficiário', REJECTED: 'Não aprovado' };

export const day = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};
const instant = (d: Date) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
const instantTime = (d: Date) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
export const money = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100).replace(/ /g, ' ');
const area = (ha: number) => `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(ha)} ha`;

export function renderProducerReport(
  r: ProducerReport,
  meta: { generatedBy: string; generatedAt: Date },
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 48, bottom: 60, left: 50, right: 50 },
    bufferPages: true,
    info: { Title: `Relatório de atendimento: ${r.producer.name}`, Author: 'AgroIntegra' },
  });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;

  // Garante espaço antes de um bloco; senão, começa uma página nova.
  const room = (h: number) => {
    if (doc.y + h > doc.page.height - doc.page.margins.bottom) doc.addPage();
  };

  const section = (title: string) => {
    room(60);
    doc.moveDown(0.9);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(C.mata).text(title, left, doc.y);
    const y = doc.y + 3;
    doc.moveTo(left, y).lineTo(left + width, y).lineWidth(0.8).strokeColor(C.linha).stroke();
    doc.y = y + 8;
    doc.font('Helvetica').fontSize(10).fillColor(C.tinta);
  };

  const field = (label: string, value: string, x: number, w: number, y: number) => {
    doc.font('Helvetica').fontSize(8.5).fillColor(C.sutil).text(label, x, y, { width: w });
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(C.tinta).text(value, x, doc.y + 1, { width: w });
    return doc.y;
  };

  const empty = (text: string) => doc.font('Helvetica-Oblique').fontSize(10).fillColor(C.sutil).text(text, left, doc.y);

  // ---------- Cabeçalho ----------
  if (existsSync(LOGO)) doc.image(LOGO, left, 40, { width: 92 });
  doc
    .font('Helvetica-Bold')
    .fontSize(17)
    .fillColor(C.tinta)
    .text('Relatório de atendimento', left + 120, 54, { width: width - 120, align: 'right' });
  doc
    .font('Helvetica')
    .fontSize(10.5)
    .fillColor(C.sutil)
    .text(`Período: ${day(r.period.from)} a ${day(r.period.to)}`, left + 120, doc.y + 4, { width: width - 120, align: 'right' });
  doc.y = 130;
  doc.moveTo(left, doc.y).lineTo(left + width, doc.y).lineWidth(2).strokeColor(C.mata).stroke();
  doc.y += 14;

  // ---------- Produtor ----------
  const col = width / 3;
  let y = doc.y;
  let bottom = Math.max(
    field('Produtor', r.producer.name, left, col * 2 - 10, y),
    field('CPF', r.producer.cpf, left + col * 2, col, y),
  );
  y = bottom + 8;
  bottom = Math.max(
    field('Comunidade', r.producer.community, left, col - 10, y),
    field('Telefone', r.producer.phone || 'Não informado', left + col, col - 10, y),
    field(
      'Consentimento LGPD',
      r.producer.consentAt ? `Registrado em ${instant(r.producer.consentAt)}` : 'Pendente',
      left + col * 2,
      col,
      y,
    ),
  );
  doc.y = bottom + 4;

  // ---------- Resumo ----------
  section('Resumo do período');
  const figures: [string, string][] = [
    ['Visitas', String(r.totals.visits)],
    ['Solicitações abertas', String(r.totals.requestsOpened)],
    ['Solicitações concluídas', String(r.totals.requestsCompleted)],
    ['Entregas de programas', `${r.totals.deliveries} (${money(r.totals.deliveredValueCents)})`],
  ];
  const fw = width / figures.length;
  y = doc.y;
  doc.rect(left, y, width, 50).fill(C.fundo);
  figures.forEach(([label, value], i) => {
    const x = left + fw * i + 10;
    doc.font('Helvetica').fontSize(8.5).fillColor(C.sutil).text(label, x, y + 9, { width: fw - 16 });
    doc.font('Helvetica-Bold').fontSize(i === 3 ? 11 : 16).fillColor(C.mata).text(value, x, y + 22, { width: fw - 16 });
  });
  doc.y = y + 50;

  // ---------- Propriedades ----------
  section('Propriedades');
  if (r.properties.length === 0) empty('Nenhuma propriedade cadastrada.');
  for (const p of r.properties) {
    room(16);
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(C.tinta)
      .text(p.name, left, doc.y, { continued: true })
      .font('Helvetica')
      .fillColor(C.sutil)
      .text(`  ·  ${p.locality}  ·  ${area(p.areaHa)}${p.mainActivity ? `  ·  ${p.mainActivity}` : ''}`);
    doc.moveDown(0.25);
  }

  // ---------- Visitas ----------
  section(`Visitas técnicas (${r.totals.visits})`);
  if (r.visits.length === 0) empty('Nenhuma visita no período.');
  r.visits.forEach((v, i) => {
    room(110);
    if (i > 0) doc.moveDown(0.6);
    doc
      .font('Helvetica-Bold')
      .fontSize(10.5)
      .fillColor(C.tinta)
      .text(day(v.visitedOn), left, doc.y, { continued: true })
      .font('Helvetica')
      .fillColor(C.sutil)
      .text(`   ${v.property ?? 'Sem propriedade'}  ·  Técnico: ${v.technician}`);
    if (v.request) doc.fontSize(9).fillColor(C.sutil).text(`Atendeu à solicitação: ${v.request}`);
    const block = (label: string, text: string) => {
      doc.moveDown(0.2);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(C.mata).text(label, left + 10, doc.y);
      doc.font('Helvetica').fontSize(10).fillColor(C.tinta).text(text, left + 10, doc.y, { width: width - 10 });
    };
    block('Diagnóstico', v.diagnosis);
    block('Plano de ação', v.actionPlan);
    if (v.impact) block('Impacto esperado', v.impact);
    doc.moveDown(0.2);
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(C.sutil)
      .text(
        [
          `Retorno: ${v.returnOn ? day(v.returnOn) : 'sem retorno previsto'}`,
          `Fotos: ${v.photoCount}`,
          `Assinatura: ${v.hasSignature ? 'coletada' : 'não coletada'}`,
          `Localização: ${v.hasLocation ? 'registrada' : 'não registrada'}`,
        ].join('   ·   '),
        left + 10,
        doc.y,
        { width: width - 10 },
      );
  });

  // ---------- Solicitações ----------
  section(`Solicitações abertas no período (${r.totals.requestsOpened})`);
  if (r.requests.length === 0) empty('Nenhuma solicitação aberta no período.');
  for (const q of r.requests) {
    room(30);
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(C.tinta)
      .text(q.subject, left, doc.y, { width });
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(C.sutil)
      .text(
        `Aberta em ${instant(q.openedAt)}  ·  Prioridade ${PRIORITY[q.priority].toLowerCase()}  ·  ${STATUS[q.status]}${
          q.completedAt ? ` em ${instant(q.completedAt)}` : ''
        }`,
      );
    doc.moveDown(0.35);
  }

  // ---------- Programas ----------
  section('Programas');
  if (r.programs.length === 0) empty('O produtor não está inscrito em programas.');
  for (const p of r.programs) {
    room(16);
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(C.tinta)
      .text(p.name, left, doc.y, { continued: true })
      .font('Helvetica')
      .fillColor(C.sutil)
      .text(`  ·  ${ENROLLMENT[p.status]}  ·  inscrição em ${day(p.enrolledOn)}`);
    doc.moveDown(0.25);
  }
  if (r.deliveries.length > 0) {
    doc.moveDown(0.4);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(C.mata).text(`Entregas no período (${r.totals.deliveries})`, left, doc.y);
    for (const d of r.deliveries) {
      room(16);
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor(C.tinta)
        .text(`${day(d.deliveredOn)}  ·  ${d.program}  ·  ${d.quantity} ${d.unit}  ·  ${money(d.valueCents)}`, left + 10, doc.y);
    }
  }

  // ---------- Rodapé em todas as páginas ----------
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const fy = doc.page.height - 40;
    doc.page.margins.bottom = 0; // deixa escrever no rodapé sem criar página nova
    doc.moveTo(left, fy - 6).lineTo(left + width, fy - 6).lineWidth(0.5).strokeColor(C.linha).stroke();
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(C.sutil)
      .text(`AgroIntegra  ·  Gerado em ${instantTime(meta.generatedAt)} por ${meta.generatedBy}`, left, fy, {
        width: width - 80,
        lineBreak: false,
      })
      .text(`Página ${i + 1} de ${range.count}`, left + width - 80, fy, { width: 80, align: 'right', lineBreak: false });
  }

  doc.end();
  return done;
}
