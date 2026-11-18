import { DecodedImage } from './image';

// Onde os bytes das fotos ficam guardados. Hoje: na própria linha VisitPhoto (bytea), como na demo.
// No piloto as fotos vão para um storage compatível com S3; a troca fica concentrada aqui
// (gravar o objeto e guardar a chave em vez dos bytes) e em quem chama estas duas funções.

export function toStoredPhoto(image: DecodedImage) {
  return { mimeType: image.mimeType, data: new Uint8Array(image.data), size: image.data.length };
}

export function fromStoredPhoto(row: { mimeType: string; data: Uint8Array }) {
  return { mimeType: row.mimeType, data: Buffer.from(row.data) };
}
