'use client';

import { useEffect, useState } from 'react';

export function useCountUp(value: number) {
  const [count, setCount] = useState(value);
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motion.matches) { setCount(value); return; }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 850);
      setCount(Math.round(value * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const stop = () => {
      if (motion.matches) { cancelAnimationFrame(frame); setCount(value); }
    };
    motion.addEventListener('change', stop);
    return () => { cancelAnimationFrame(frame); motion.removeEventListener('change', stop); };
  }, [value]);
  return count;
}
