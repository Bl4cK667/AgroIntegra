/* eslint-disable @next/next/no-img-element */
// Logo oficial do AgroIntegra (arquivos em public/brand).

// Só o símbolo, num quadrado branco: sobre o verde do menu o "A" verde não apareceria.
export function BrandSymbol({ size = 34 }: { size?: number }) {
  return (
    <span
      style={{
        display: 'inline-grid',
        placeItems: 'center',
        width: size,
        height: size,
        borderRadius: 6,
        background: '#fff',
        flex: 'none',
      }}
    >
      <img src="/brand/agrointegra-simbolo.png" alt="" width={size - 8} height={size - 8} style={{ objectFit: 'contain' }} />
    </span>
  );
}

// Logo completa: símbolo, nome e slogan.
export function BrandLogo({ width = 240 }: { width?: number }) {
  return (
    <img
      src="/brand/agrointegra-logo.png"
      alt="AgroIntegra — Gestão integrada para o desenvolvimento rural"
      width={width}
      height={Math.round((width * 541) / 623)}
      style={{ display: 'block', height: 'auto', maxWidth: '100%' }}
    />
  );
}
