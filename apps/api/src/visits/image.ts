import { BadRequestException } from '@nestjs/common';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

// Confere o tipo pelo conteúdo do arquivo (assinatura de bytes), não pelo nome.
function sniff(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

export interface DecodedImage {
  mimeType: string;
  data: Buffer;
}

// Recebe "data:image/...;base64,..." e devolve os bytes, recusando o que não for imagem.
export function decodeImage(dataUrl: string, label: string, allowed = ['image/jpeg', 'image/png', 'image/webp']): DecodedImage {
  const match = /^data:[\w/+.-]+;base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl ?? '');
  if (!match) throw new BadRequestException(`${label}: envie uma imagem JPEG, PNG ou WebP.`);
  const data = Buffer.from(match[1], 'base64');
  if (data.length > MAX_IMAGE_BYTES) throw new BadRequestException(`${label}: a imagem passa de 2 MB.`);
  const mimeType = sniff(data);
  if (!mimeType || !allowed.includes(mimeType)) {
    throw new BadRequestException(`${label}: o arquivo enviado não é uma imagem válida.`);
  }
  return { mimeType, data };
}
