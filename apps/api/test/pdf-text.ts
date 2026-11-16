// Lê o texto de um PDF (todas as páginas) com o pdf.js, o mesmo motor de leitura do Firefox.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');

export async function pdfText(buf: Buffer): Promise<{ text: string; pages: number }> {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, verbosity: 0 }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    parts.push(content.items.map((it: { str?: string }) => it.str ?? '').join(' '));
  }
  return { text: parts.join('\n'), pages: doc.numPages };
}

// Compara ignorando espaços: o PDF pode quebrar uma frase em pedaços.
export const squash = (s: string) => s.replace(/\s+/g, '');
