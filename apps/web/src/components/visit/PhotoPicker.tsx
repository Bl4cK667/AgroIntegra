'use client';

import { useRef, useState } from 'react';
import styles from './visit.module.css';

const MAX_PHOTOS = 3;
const MAX_SIDE = 1600;

// Reduz a foto no próprio aparelho (lado maior 1600 px, JPEG) antes de enviar.
async function shrink(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.82);
}

export function PhotoPicker({ value, onChange }: { value: string[]; onChange: (photos: string[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const room = MAX_PHOTOS - value.length;
    const chosen = Array.from(files).slice(0, room);
    if (files.length > room) setError(`Cabem no máximo ${MAX_PHOTOS} fotos por visita.`);
    setBusy(true);
    try {
      const added: string[] = [];
      for (const f of chosen) {
        if (!f.type.startsWith('image/')) {
          setError('Escolha arquivos de imagem.');
          continue;
        }
        added.push(await shrink(f));
      }
      onChange([...value, ...added]);
    } catch {
      setError('Não foi possível ler a imagem. Tente outra foto.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div className="field">
      <span>
        Fotos <span className={styles.optional}>até {MAX_PHOTOS}, opcional</span>
      </span>
      <div className={styles.photos}>
        {value.map((src, i) => (
          <figure key={i} className={styles.thumb}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`Foto ${i + 1}`} />
            <button type="button" className={styles.thumbRemove} onClick={() => onChange(value.filter((_, j) => j !== i))}>
              Remover
            </button>
          </figure>
        ))}
        {value.length < MAX_PHOTOS && (
          <button type="button" className={styles.addPhoto} onClick={() => input.current?.click()} disabled={busy}>
            {busy ? 'Preparando…' : value.length === 0 ? 'Adicionar fotos' : 'Mais uma foto'}
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => onFiles(e.target.files)}
      />
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}
