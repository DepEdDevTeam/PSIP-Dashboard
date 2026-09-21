'use client';

import { useLayoutEffect, useRef } from 'react';
import { getMotionProfile, gsap } from '@/lib/animation';

const format = new Intl.NumberFormat('en-US');

export function AnimatedNumber({ value }: { value: number | string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const numeric = typeof value === 'number' ? value : /^\d+%$/.test(value) ? Number(value.slice(0, -1)) : null;
  const suffix = typeof value === 'string' && value.endsWith('%') ? '%' : '';
  const previous = useRef(numeric ?? 0);
  const label = typeof value === 'number' ? format.format(value) : value;
  useLayoutEffect(() => {
    if (numeric === null || !ref.current) return;
    const element = ref.current;
    const counter = { value: previous.current };
    const media = gsap.matchMedia();
    media.add({ reduce: '(prefers-reduced-motion: reduce)', all: 'all' }, () => {
      const profile = getMotionProfile();
      if (profile === 'reduced') { element.textContent = label; previous.current = numeric; return; }
      gsap.to(counter, { value: numeric, duration: profile === 'lite' ? 0.24 : 0.45, ease: 'power2.out', onUpdate: () => {
        previous.current = counter.value;
        element.textContent = `${format.format(Math.round(counter.value))}${suffix}`;
      }, onComplete: () => { element.textContent = label; } });
    });
    return () => media.revert();
  }, [numeric, suffix, label]);
  return <span aria-label={label}><span ref={ref} aria-hidden="true">{label}</span></span>;
}
