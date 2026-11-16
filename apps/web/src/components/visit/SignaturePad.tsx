'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import styles from './visit.module.css';

export interface SignaturePadHandle {
  // PNG da assinatura, ou null se nada foi desenhado.
  toDataUrl(): string | null;
}

// Assinatura do produtor desenhada com o dedo, caneta ou mouse.
export const SignaturePad = forwardRef<SignaturePadHandle>(function SignaturePad(_, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  // Ajusta a resolução do canvas à tela para o traço não ficar serrilhado.
  useEffect(() => {
    const c = canvas.current!;
    const ratio = window.devicePixelRatio || 1;
    const { width, height } = c.getBoundingClientRect();
    c.width = Math.round(width * ratio);
    c.height = Math.round(height * ratio);
    const ctx = c.getContext('2d')!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#18211c';
  }, []);

  useImperativeHandle(ref, () => ({
    toDataUrl: () => (empty ? null : canvas.current!.toDataURL('image/png')),
  }));

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = e.currentTarget.getContext('2d')!;
    const { x, y } = point(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.1, y + 0.1);
    ctx.stroke();
    setEmpty(false);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = e.currentTarget.getContext('2d')!;
    const { x, y } = point(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function up() {
    drawing.current = false;
  }

  function clear() {
    const c = canvas.current!;
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    setEmpty(true);
  }

  return (
    <div className="field">
      <span>
        Assinatura do produtor <span className={styles.optional}>opcional</span>
      </span>
      <div className={styles.signature}>
        <canvas
          ref={canvas}
          aria-label="Área para o produtor assinar"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        />
        <span className={styles.signatureLine} aria-hidden="true" />
        {empty && <span className={styles.signatureHint}>Assine aqui</span>}
      </div>
      {!empty && (
        <button type="button" className="btn-link" onClick={clear} style={{ justifySelf: 'start' }}>
          Limpar assinatura
        </button>
      )}
    </div>
  );
});
