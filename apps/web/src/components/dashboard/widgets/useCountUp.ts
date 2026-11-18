'use client';

// Antes, o número contava de 0 até o valor em quase 1 segundo. No redesign corporativo o
// valor aparece direto: durante a contagem a tela mostrava um número errado.
// A função continua existindo para não mudar quem a usa (widgets/Widgets.tsx).
export function useCountUp(value: number) {
  return value;
}
