'use client';

import { useLayoutEffect } from 'react';
import { getMotionProfile, gsap } from '@/lib/animation';

export function LandingAnimation() {
  useLayoutEffect(() => {
    const media = gsap.matchMedia();
    media.add({ reduce: '(prefers-reduced-motion: reduce)', all: 'all' }, () => {
      const profile = getMotionProfile();
      const reduced = profile === 'reduced';
      const lite = profile === 'lite';
      gsap.from('.landing-hero header, #home > h1, #home > p, #home > a', {
        opacity: reduced ? 0.72 : lite ? 0.35 : 0, y: reduced ? 0 : lite ? 6 : 14, duration: reduced ? 0.14 : lite ? 0.25 : 0.45,
        stagger: reduced ? 0 : lite ? 0.025 : 0.07, ease: 'power2.out', clearProps: 'transform,opacity',
      });
    });
    return () => media.revert();
  }, []);
  return null;
}
