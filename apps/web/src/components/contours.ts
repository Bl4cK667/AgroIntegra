// Gera curvas de nível (contornos fechados e irregulares) de forma determinística.
// Usado na marca e no painel de login: remete ao relevo de uma propriedade rural.

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

interface ContourOptions {
  cx: number;
  cy: number;
  rings: number;
  baseRadius: number;
  step: number;
  seed: number;
  wobble?: number;
  points?: number;
}

export function contourPaths({ cx, cy, rings, baseRadius, step, seed, wobble = 0.18, points = 72 }: ContourOptions): string[] {
  const rand = rng(seed);
  // Mesmas ondulações para todos os anéis, com intensidade crescente: parecem curvas de um mesmo morro.
  const waves = Array.from({ length: 4 }, (_, i) => ({
    freq: i + 2,
    amp: (rand() * 0.6 + 0.4) / (i + 1),
    phase: rand() * Math.PI * 2,
  }));

  const paths: string[] = [];
  for (let r = 0; r < rings; r++) {
    const radius = baseRadius + r * step;
    const strength = wobble * (0.6 + r / rings);
    const pts: [number, number][] = [];
    for (let i = 0; i < points; i++) {
      const a = (i / points) * Math.PI * 2;
      const n = waves.reduce((acc, w) => acc + w.amp * Math.sin(w.freq * a + w.phase + r * 0.12), 0);
      const rr = radius * (1 + strength * n);
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.82]);
    }
    paths.push(smoothClosed(pts));
  }
  return paths;
}

// Curva suave fechada (Catmull-Rom convertida para Bézier).
function smoothClosed(pts: [number, number][]): string {
  const n = pts.length;
  const f = (v: number) => v.toFixed(1);
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${f(c1x)},${f(c1y)} ${f(c2x)},${f(c2y)} ${f(p2[0])},${f(p2[1])}`;
  }
  return d + 'Z';
}
