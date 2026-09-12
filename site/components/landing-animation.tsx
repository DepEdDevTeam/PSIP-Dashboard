'use client';

import { useLayoutEffect } from 'react';
import { gsap } from '@/lib/animation';

export function LandingAnimation() {
  useLayoutEffect(() => {
    const media = gsap.matchMedia();
    media.add({ reduce: '(prefers-reduced-motion: reduce)', full: '(prefers-reduced-motion: no-preference)' }, (context) => {
      const reduced = !!context.conditions?.reduce;
      gsap.from('.landing-hero header, #home > h1, #home > p, #home > a', {
        opacity: reduced ? 0.8 : 0, y: reduced ? 0 : 14, duration: reduced ? 0.1 : 0.45,
        stagger: reduced ? 0 : 0.07, ease: 'power2.out', clearProps: 'transform,opacity',
      });
    });
    return () => media.revert();
  }, []);
  return null;
}
