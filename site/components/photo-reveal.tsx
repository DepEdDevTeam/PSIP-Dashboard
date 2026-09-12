'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { gsap, scrollContainer } from '@/lib/animation';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function PhotoReveal({ children, imageKey }: { children: ReactNode; imageKey: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = ref.current!;
    const image = root.querySelector('img');
    if (!image) return;
    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    const reveal = () => {
      media.add({ reduce: '(prefers-reduced-motion: reduce)', full: '(prefers-reduced-motion: no-preference)' }, (context) => {
        const reduced = !!context.conditions?.reduce;
        const animation = gsap.timeline({ scrollTrigger: { trigger: root, scroller: scrollContainer(root), start: 'top 95%', once: true } });
        animation.fromTo(image, { opacity: 0.5, scale: reduced ? 1 : 1.18, xPercent: reduced ? 0 : -2 }, { opacity: 1, scale: 1, xPercent: 0, duration: reduced ? 0.12 : 1.1, ease: 'power2.out', clearProps: 'transform,opacity' });
        if (!reduced) animation.fromTo(root, { clipPath: 'inset(0 0 8% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 0.55, ease: 'power2.out', clearProps: 'clipPath' }, 0);
      });
    };
    if (image.complete && image.naturalWidth) reveal();
    else image.addEventListener('load', reveal, { once: true });
    return () => { image.removeEventListener('load', reveal); media.revert(); };
  }, [imageKey]);
  return <div ref={ref} className="overflow-hidden">{children}</div>;
}
