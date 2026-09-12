'use client';

import Image from 'next/image';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Columns2,
  Pause,
  Play,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { gsap } from '@/lib/animation';
import { groupSiteUpdates, type DemoPhoto } from '@/lib/demo-site-photos';
import { dateLabel, photoButton, type PhotoSchool } from './site-update-shared';

export function SiteProgressExplorer({
  photos,
  school,
  onSubmit,
  onClose,
}: {
  photos: DemoPhoto[];
  school: PhotoSchool;
  onSubmit: () => void;
  onClose: () => void;
}) {
  // Filter BEFORE grouping: a partly approved visit exposes only approved images.
  const batches = groupSiteUpdates(
    photos.filter(
      (p) => p.schoolId === school.schoolId && p.status === 'approved',
    ),
  );
  const [batchId, setBatchId] = useState('');
  const [photoId, setPhotoId] = useState('');
  const [playing, setPlaying] = useState(false);
  const [compare, setCompare] = useState(false);
  const [compareId, setCompareId] = useState('');
  const [split, setSplit] = useState(50);
  const [direction, setDirection] = useState(1);
  const surface = useRef<HTMLDivElement>(null);
  const position = Math.max(
    0,
    batches.findIndex((b) => (b[0].batchId ?? b[0].id) === batchId),
  );
  const batch = batches[position];
  const photo = batch?.find((p) => p.id === photoId) ?? batch?.[0];
  const photoIndex = photo ? batch.indexOf(photo) : 0;
  const compatible =
    photo?.viewpoint && photo.viewpoint !== 'Other'
      ? batches
          .filter(
            (b) =>
              b !== batch &&
              (b[0].dateTaken ?? b[0].submittedAt.slice(0, 10)) !==
                (photo.dateTaken ?? photo.submittedAt.slice(0, 10)),
          )
          .flatMap((b) => b.filter((p) => p.viewpoint === photo.viewpoint))
      : [];
  const comparison =
    compatible.find((p) => p.id === compareId) ?? compatible[0];
  const comparing = compare && !!comparison;

  function selectBatch(index: number, automatic = false) {
    const next = batches[index];
    if (!next) return;
    if (!automatic) setPlaying(false);
    setDirection(index >= position ? 1 : -1);
    setBatchId(next[0].batchId ?? next[0].id);
    setPhotoId(
      next.find((p) => p.viewpoint && p.viewpoint === photo?.viewpoint)?.id ??
        next[0].id,
    );
  }
  useEffect(() => {
    if (!playing) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const stop = () => setPlaying(false);
    const visibility = () => {
      if (document.hidden) stop();
    };
    media.addEventListener('change', stop);
    document.addEventListener('visibilitychange', visibility);
    const timer = window.setTimeout(
      () => {
        if (position < batches.length - 1) selectBatch(position + 1, true);
        else stop();
      },
      media.matches ? 6000 : 4500,
    );
    return () => {
      clearTimeout(timer);
      media.removeEventListener('change', stop);
      document.removeEventListener('visibilitychange', visibility);
    };
  });
  useLayoutEffect(() => {
    if (!surface.current || !photo) return;
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(
        surface.current,
        { opacity: 0.35, x: direction * 16, scale: 1.015 },
        {
          opacity: 1,
          x: 0,
          scale: 1,
          duration: 0.55,
          ease: 'power2.out',
          clearProps: 'transform,opacity',
        },
      );
    });
    return () => media.revert();
  }, [photo?.id, direction]);

  if (!photo)
    return (
      <div className="flex min-h-[55dvh] flex-col items-center justify-center px-5 text-center">
        <Camera className="mb-5 size-12 text-blue-300" aria-hidden="true" />
        <h2 className="text-2xl font-bold">No verified site updates yet.</h2>
        <p className="mt-3 max-w-md text-base leading-7 text-slate-300">
          Help document the current condition of this school project.
        </p>
        <Button
          className={`${photoButton} mt-6 bg-white text-slate-950 hover:bg-blue-100`}
          onClick={onSubmit}
        >
          <Camera aria-hidden="true" />
          Submit Site Update
        </Button>
        <p className="mt-4 text-sm text-slate-300">
          Community submissions are reviewed before appearing publicly.
        </p>
        <Button
          variant="ghost"
          className={`${photoButton} mt-4 text-white hover:bg-white/10 hover:text-white`}
          onClick={onClose}
        >
          <ArrowLeft aria-hidden="true" />
          Return to Map
        </Button>
      </div>
    );

  const darkButton = `${photoButton} border-white/25 bg-white/5 text-white hover:bg-white/15 hover:text-white`;
  return (
    <div
      className="space-y-4"
      onFocusCapture={() => {
        if (playing) setPlaying(false);
      }}
    >
      <div
        className="relative overflow-hidden rounded-xl bg-black"
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault();
            setPlaying(false);
            const delta = e.key === 'ArrowRight' ? 1 : -1;
            setDirection(delta);
            setPhotoId(
              batch[(photoIndex + delta + batch.length) % batch.length].id,
            );
          }
        }}
        tabIndex={0}
        aria-label="Site photograph. Use left and right arrow keys to change photos."
      >
        <div
          ref={surface}
          className="relative h-[42dvh] min-h-48 sm:h-[40dvh]"
          style={{ touchAction: comparing ? 'pan-y' : 'auto' }}
          onPointerDown={(event) => {
            if (!comparing) return;
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            const bounds = event.currentTarget.getBoundingClientRect();
            setSplit(
              Math.max(
                0,
                Math.min(
                  100,
                  ((event.clientX - bounds.left) / bounds.width) * 100,
                ),
              ),
            );
          }}
          onPointerMove={(event) => {
            if (
              !comparing ||
              !event.currentTarget.hasPointerCapture(event.pointerId)
            )
              return;
            const bounds = event.currentTarget.getBoundingClientRect();
            setSplit(
              Math.max(
                0,
                Math.min(
                  100,
                  ((event.clientX - bounds.left) / bounds.width) * 100,
                ),
              ),
            );
          }}
          onPointerUp={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              event.currentTarget.releasePointerCapture(event.pointerId);
          }}
        >
          <Image
            unoptimized
            src={photo.image}
            fill
            sizes="95vw"
            alt={`${school.schoolName} · ${dateLabel(photo)} · ${photo.viewpoint ?? 'Unclassified view'}`}
            className="object-contain"
          />
          {comparing && (
            <div
              className="absolute inset-0"
              style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
            >
              <Image
                unoptimized
                src={comparison.image}
                fill
                sizes="95vw"
                alt={`Comparison: ${dateLabel(comparison)} · ${comparison.viewpoint}`}
                className="bg-black object-contain"
              />
            </div>
          )}
          {comparing && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-lg"
              style={{ left: `${split}%` }}
            >
              <span className="absolute top-1/2 -translate-x-1/2 rounded-full border bg-white p-2 text-slate-950">
                ↔
              </span>
            </div>
          )}
        </div>
        {!comparing && batch.length > 1 && (
          <div className="pointer-events-none absolute inset-x-3 top-1/2 flex -translate-y-1/2 justify-between">
            {[-1, 1].map((delta) => (
              <Button
                key={delta}
                variant="outline"
                className="pointer-events-auto size-11 rounded-full border-white/25 bg-black/60 text-white hover:bg-black/80 hover:text-white"
                aria-label={delta < 0 ? 'Previous photo' : 'Next photo'}
                onClick={() => {
                  setPlaying(false);
                  setDirection(delta);
                  setPhotoId(
                    batch[(photoIndex + delta + batch.length) % batch.length]
                      .id,
                  );
                }}
              >
                {delta < 0 ? (
                  <ArrowLeft aria-hidden="true" />
                ) : (
                  <ArrowRight aria-hidden="true" />
                )}
              </Button>
            ))}
          </div>
        )}
        <span className="absolute right-3 top-3 rounded-full bg-black/65 px-3 py-1 text-xs text-white">
          {comparing
            ? 'Compare dates'
            : `${photoIndex + 1} / ${batch.length} photos`}
        </span>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-200">
            {dateLabel(photo)}
            {!photo.dateTaken && ' · submission date'}
          </p>
          <h2 className="mt-1 break-words text-xl font-semibold">
            {photo.title ||
              photo.stage ||
              photo.category ||
              'Community site update'}
          </h2>
          {photo.title && (
            <p className="text-sm text-slate-300">
              {photo.stage || photo.category}
            </p>
          )}
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-xs text-emerald-200">
          <ShieldCheck className="size-4" aria-hidden="true" />
          Approved Community Site Update
        </span>
      </div>
      <div
        className="flex gap-2 overflow-x-auto pb-1"
        aria-label="Available viewpoints"
      >
        {batch.map((p, i) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={p.id === photo.id}
            className={`min-h-11 shrink-0 rounded-xl border px-4 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 ${p.id === photo.id ? 'border-blue-300 bg-blue-100 text-blue-950' : 'border-white/20 text-slate-200 hover:bg-white/10'}`}
            onClick={() => {
              setPlaying(false);
              setDirection(i >= photoIndex ? 1 : -1);
              setPhotoId(p.id);
            }}
          >
            {p.viewpoint ?? 'Unclassified'}
            {batch.filter((other) => other.viewpoint === p.viewpoint).length > 1
              ? ` · ${i + 1}`
              : ''}
          </button>
        ))}
      </div>
      {photo.remarks && (
        <p className="max-w-3xl whitespace-pre-wrap break-words text-sm leading-6 text-slate-300">
          {photo.remarks}
        </p>
      )}
      <div className="border-t border-white/15 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-300">
            Visit timeline
          </p>
          <p className="text-xs text-slate-400">
            {batches.length} approved{' '}
            {batches.length === 1 ? 'update' : 'updates'}
          </p>
        </div>
        <div
          className="flex gap-2 overflow-x-auto pb-2"
          aria-label="Approved site update timeline"
        >
          {batches.map((b, i) => (
            <button
              key={b[0].batchId ?? b[0].id}
              type="button"
              aria-pressed={i === position}
              className={`min-h-16 min-w-36 shrink-0 rounded-xl border px-4 py-2 text-left focus-visible:outline-2 ${i === position ? 'border-blue-300 bg-blue-400/15 text-white' : 'border-white/10 text-slate-300 hover:bg-white/5'}`}
              onClick={() => selectBatch(i)}
            >
              <span
                className={`mb-2 block h-0.5 w-full ${i === position ? 'bg-blue-300' : 'bg-slate-600'}`}
              />
              <span className="block text-sm font-semibold">
                {dateLabel(b[0])}
              </span>
              <span className="text-xs">
                {b[0].stage || b[0].category || 'Site update'} · {b.length}{' '}
                {b.length === 1 ? 'photo' : 'photos'}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap justify-between gap-2">
        <Button
          variant="outline"
          className={darkButton}
          disabled={!compatible.length}
          aria-pressed={comparing}
          onClick={() => {
            setCompare(!comparing);
            setPlaying(false);
          }}
        >
          <Columns2 aria-hidden="true" />
          {comparing ? 'Exit compare' : 'Compare'}
        </Button>
        <Button
          variant="outline"
          className={darkButton}
          disabled={batches.length < 2}
          onClick={() => {
            if (!playing && position === batches.length - 1) selectBatch(0);
            setCompare(false);
            setPlaying(!playing);
          }}
        >
          {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          {playing ? 'Pause Progress' : 'Play Progress'}
        </Button>
      </div>
      {comparing ? (
        <div className="space-y-3 rounded-xl border border-white/15 p-4">
          <label className="block space-y-2 text-sm">
            <span>
              Compare {dateLabel(photo)} · {photo.viewpoint} with
            </span>
            <select
              value={comparison.id}
              onChange={(e) => setCompareId(e.target.value)}
              className="min-h-11 w-full rounded-lg border border-slate-500 bg-slate-900 px-3 text-white"
            >
              {compatible.map((p) => (
                <option key={p.id} value={p.id}>
                  {dateLabel(p)} · {p.viewpoint} · Photo {(p.order ?? 0) + 1}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="flex justify-between gap-3">
              <span>{dateLabel(comparison)}</span>
              <span>{dateLabel(photo)}</span>
            </span>
            <input
              aria-label="Before and after comparison position"
              type="range"
              min={0}
              max={100}
              value={split}
              onChange={(e) => setSplit(Number(e.target.value))}
              className="min-h-11 w-full accent-blue-300"
            />
          </label>
          <p className="text-xs text-slate-300">
            Drag across the photo or use the slider. Same documented viewpoint;
            camera position and framing may differ.
          </p>
        </div>
      ) : (
        <p className="text-xs text-slate-400">
          {compatible.length
            ? 'Compare photos of the same viewpoint across different dates.'
            : 'Comparison becomes available when another date has the same documented viewpoint.'}
        </p>
      )}
      <p className="text-xs leading-5 text-slate-400">
        Reviewed for display, not official DepEd documentation or independent
        verification of every observation. Normal 2D photos, not a 360°
        panorama. Local demo only.
      </p>
    </div>
  );
}
