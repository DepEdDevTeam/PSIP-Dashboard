'use client';

import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Dialog as Primitive } from '@base-ui/react/dialog';
import {
  Dialog as BaseDialog,
  DialogClose,
  DialogOverlay,
  DialogPortal,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { gsap } from '@/lib/animation';
import { cn } from '@/lib/utils';

const TransitionContext = createContext({ open: false, finish: () => {} });

// Keep Base UI's focus trap and dismissal active until the short closing timeline ends.
export function AnimatedPhotoDialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  const [presented, setPresented] = useState(open);
  useLayoutEffect(() => {
    if (open) setPresented(true);
  }, [open]);
  return (
    <TransitionContext.Provider
      value={{ open, finish: () => setPresented(false) }}
    >
      <BaseDialog open={open || presented} onOpenChange={onOpenChange}>
        {children}
      </BaseDialog>
    </TransitionContext.Provider>
  );
}

export function AnimatedPhotoDialogContent({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <DialogPortal>
      <PhotoDialogSurface className={className}>{children}</PhotoDialogSurface>
    </DialogPortal>
  );
}

function PhotoDialogSurface({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  const { open, finish } = useContext(TransitionContext);
  const popup = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const finishRef = useRef(finish);
  finishRef.current = finish;
  const openRef = useRef(open);
  openRef.current = open;
  useLayoutEffect(() => {
    const media = gsap.matchMedia();
    media.add(
      {
        reduce: '(prefers-reduced-motion: reduce)',
        full: '(prefers-reduced-motion: no-preference)',
      },
      (context) => {
        const reduced = !!context.conditions?.reduce;
        const animation = gsap.timeline({
          paused: true,
          onReverseComplete: () => finishRef.current(),
        });
        animation
          .fromTo(
            backdrop.current,
            { opacity: 0 },
            { opacity: 1, duration: reduced ? 0.08 : 0.18 },
          )
          .fromTo(
            popup.current,
            { opacity: 0, scale: reduced ? 1 : 0.975, y: reduced ? 0 : 12 },
            {
              opacity: 1,
              scale: 1,
              y: 0,
              duration: reduced ? 0.1 : 0.26,
              ease: 'power2.out',
            },
            0,
          )
          .fromTo(
            popup.current!.querySelectorAll(
              '[data-slot="dialog-title"], [data-slot="dialog-description"]',
            ),
            { opacity: 0 },
            { opacity: 1, duration: 0.12, stagger: reduced ? 0 : 0.04 },
            reduced ? 0 : 0.1,
          );
        timeline.current = animation;
        if (openRef.current) animation.play();
        else finishRef.current();
      },
    );
    return () => media.revert();
  }, []);
  useLayoutEffect(() => {
    if (open) timeline.current?.timeScale(1).play();
    else if (timeline.current && timeline.current.time() > 0)
      timeline.current.timeScale(1.5).reverse();
    else finishRef.current();
  }, [open]);
  return (
    <>
      <DialogOverlay
        ref={backdrop}
        className="bg-black/40"
        style={{ animation: 'none' }}
      />
      <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center">
        <Primitive.Popup
          ref={popup}
          data-slot="dialog-content"
          className={cn(
            'pointer-events-auto relative grid w-full max-w-[calc(100%-2rem)] rounded-xl bg-popover text-sm text-popover-foreground ring-1 ring-foreground/10 outline-none sm:max-w-sm',
            className,
            'overflow-hidden p-0 sm:p-0',
          )}
        >
          <div className="grid max-h-[inherit] gap-4 overflow-y-auto overscroll-contain p-5 sm:p-6">
            {children}
          </div>
          <DialogClose
            data-slot="dialog-close"
            render={
              <Button
                variant="outline"
                className="absolute top-2 right-2 z-20 size-11 bg-popover text-popover-foreground shadow-sm"
              />
            }
          >
            <X aria-hidden="true" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </Primitive.Popup>
      </div>
    </>
  );
}
