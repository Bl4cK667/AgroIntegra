import { contourPaths } from './contours';

const PATHS = contourPaths({ cx: 16, cy: 16, rings: 3, baseRadius: 3.2, step: 4.2, seed: 7, wobble: 0.14, points: 40 });

export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      {PATHS.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth={i === 0 ? 2.2 : 1.6} opacity={1 - i * 0.22} />
      ))}
    </svg>
  );
}
