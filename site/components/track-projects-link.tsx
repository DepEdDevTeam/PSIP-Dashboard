'use client';

import { useEffect, useRef, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { gsap } from 'gsap';

export function TrackProjectsLink() {
  const router = useRouter();
  const linkRef = useRef<HTMLAnchorElement>(null);
  const animation = useRef<gsap.Context | null>(null);
  const navigating = useRef(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Restore the original appearance when returning through browser history.
    const reset = () => {
      animation.current?.revert();
      animation.current = null;
      navigating.current = false;
      setBusy(false);
    };
    window.addEventListener('pageshow', reset);
    return () => {
      window.removeEventListener('pageshow', reset);
      animation.current?.revert();
    };
  }, []);

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    // Keep native new-tab and modified-click behavior.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (navigating.current) {
      event.preventDefault();
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    event.preventDefault();
    navigating.current = true;
    setBusy(true);
    const link = linkRef.current;
    animation.current = gsap.context(() => {
      const timeline = gsap.timeline({ onComplete: () => router.push('/dashboard') });
      timeline
        .to(link, { scale: 0.94, duration: 0.1, ease: 'power2.out' })
        .to(link, { scale: 1.025, duration: 0.2, ease: 'back.out(2)' })
        .to(link, { scale: 1, duration: 0.15, ease: 'power2.out' });
      const content = link?.closest('#home');
      if (content) {
        timeline.to(content, { y: -12, opacity: 0.35, duration: 0.25, ease: 'power2.inOut' }, 0.2);
      }
    }, linkRef);
  }

  return (
    <Link
      ref={linkRef}
      href="/dashboard"
      prefetch
      onClick={handleClick}
      aria-busy={busy || undefined}
      aria-disabled={busy || undefined}
      className="mt-14 rounded-[1.45rem] bg-[#3d578d]/90 px-14 py-5 text-2xl font-extrabold tracking-tight text-white shadow-[0_12px_28px_rgba(17,42,93,0.2)] transition-colors hover:bg-[#304b80] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-[#294783]"
    >
      TRACK PROJECTS
    </Link>
  );
}
