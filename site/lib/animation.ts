'use client';

import { useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export { gsap };

export type MotionProfile = 'full' | 'lite' | 'reduced';

/**
 * The profile is bootstrapped before React hydrates (see app/layout.tsx). Keep
 * this fallback feature-safe for browsers that do not expose device hints.
 */
export function getMotionProfile(): MotionProfile {
  if (typeof document === 'undefined') return 'full';
  if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'reduced';
  const profile = document.documentElement.dataset.motion;
  return profile === 'lite' ? 'lite' : 'full';
}

export function motionValue<T>(values: { full: T; lite: T; reduced: T }): T {
  return values[getMotionProfile()];
}

export function scrollContainer(element: Element): Element | undefined {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(parent).overflowY)) return parent;
  }
}

// Scoped to presentation elements: never target chart internals or map canvases.
export function useReveals<T extends HTMLElement>(revision: unknown = '', selector = '[data-reveal]') {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    media.add({ reduce: '(prefers-reduced-motion: reduce)', all: 'all' }, () => {
      const profile = getMotionProfile();
      const reduced = profile === 'reduced';
      const lite = profile === 'lite';
      const root = ref.current!;
      const targets = Array.from(root.querySelectorAll<HTMLElement>(selector));
      const immediate: HTMLElement[] = [];
      targets.forEach((element) => {
        const scroller = scrollContainer(element);
        const rect = element.getBoundingClientRect();
        const boundary = scroller?.getBoundingClientRect();
        const visible = rect.bottom > (boundary?.top ?? 0) && rect.top < Math.min(boundary?.bottom ?? innerHeight, innerHeight);
        if (visible && (selector !== 'tbody tr' || immediate.length < 16)) immediate.push(element);
        else if (!reduced && selector !== 'tbody tr') {
          gsap.from(element, {
            opacity: lite ? 0.35 : 0, y: lite ? 6 : 14, duration: lite ? 0.22 : 0.38, ease: 'power2.out', clearProps: 'transform,opacity',
            scrollTrigger: { trigger: element, scroller, start: 'top 95%', once: true },
          });
        }
      });
      gsap.from(immediate, {
        opacity: reduced ? 0.72 : lite ? 0.35 : 0, y: reduced ? 0 : lite ? 5 : 12, scale: reduced || lite ? 1 : 0.985,
        duration: reduced ? 0.14 : lite ? 0.22 : 0.36, stagger: reduced ? 0 : lite ? 0.02 : { each: 0.045, amount: Math.min(immediate.length * 0.045, 0.22) },
        ease: 'power2.out', clearProps: 'transform,opacity',
      });
    }, ref);
    return () => media.revert();
  }, [revision, selector]);
  return ref;
}

export function useEntrance<T extends HTMLElement>(revision: unknown = '', x = 0) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const media = gsap.matchMedia();
    media.add({ reduce: '(prefers-reduced-motion: reduce)', all: 'all' }, () => {
      const profile = getMotionProfile();
      const reduced = profile === 'reduced';
      const lite = profile === 'lite';
      gsap.from(ref.current, { opacity: reduced ? 0.72 : 0.4, x: reduced ? 0 : lite ? x * 0.4 : x, y: reduced || x ? 0 : lite ? 4 : 8, duration: reduced ? 0.14 : lite ? 0.2 : 0.28, ease: 'power2.out', clearProps: 'transform,opacity' });
    });
    return () => media.revert();
  }, [revision, x]);
  return ref;
}

export function useDrawer(open: boolean) {
  const ref = useRef<HTMLElement>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const openRef = useRef(open);
  openRef.current = open;
  useLayoutEffect(() => {
    if (!ref.current) return;
    const media = gsap.matchMedia();
    media.add({ reduce: '(prefers-reduced-motion: reduce)', all: 'all' }, () => {
      const element = ref.current!;
      const profile = getMotionProfile();
      const reduced = profile === 'reduced';
      const lite = profile === 'lite';
      const animation = gsap.timeline({ paused: true, onReverseComplete: () => { gsap.set(element, { display: 'none' }); } });
      animation.fromTo(element, { opacity: 0, x: reduced ? 0 : lite ? -8 : -18 }, { opacity: 1, x: 0, duration: reduced ? 0.14 : lite ? 0.2 : 0.25, ease: 'power2.out' });
      timeline.current = animation;
      if (openRef.current) { gsap.set(element, { display: 'block' }); animation.play(); }
    });
    return () => media.revert();
  }, []);
  useLayoutEffect(() => {
    if (open) { gsap.set(ref.current, { display: 'block' }); timeline.current?.timeScale(1).play(); }
    else timeline.current?.timeScale(1.5).reverse();
  }, [open]);
  return ref;
}
