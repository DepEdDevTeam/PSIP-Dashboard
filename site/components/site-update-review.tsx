'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Check, Expand, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEntrance } from '@/lib/animation';
import {
  groupSiteUpdates,
  reviewPhoto,
  type DemoPhoto,
} from '@/lib/demo-site-photos';
import {
  dateLabel,
  PhotoPreview,
  photoButton,
  SchoolContext,
  StatusBadge,
  type PhotoSchool,
} from './site-update-shared';

function ReviewPhoto({
  photo,
  inspect,
}: {
  photo: DemoPhoto;
  inspect: () => void;
}) {
  const ref = useEntrance<HTMLDivElement>(photo.status);
  return (
    <article className="overflow-hidden rounded-xl border bg-background">
      <button
        type="button"
        className="group relative block w-full focus-visible:outline-2"
        onClick={inspect}
        aria-label={`Inspect ${photo.viewpoint ?? 'site'} photo ${Number(photo.order ?? 0) + 1}`}
      >
        <Image
          unoptimized
          loading="lazy"
          width={640}
          height={480}
          src={photo.image}
          alt={`${photo.schoolName} · ${photo.viewpoint ?? 'Site photo'}`}
          className="aspect-[4/3] w-full bg-muted object-contain"
        />
        <span className="absolute bottom-2 right-2 rounded-lg bg-black/70 p-2 text-white">
          <Expand className="size-4" aria-hidden="true" />
        </span>
      </button>
      <div className="space-y-3 p-3">
        <p className="text-sm font-semibold">
          {photo.viewpoint ?? 'Unclassified view'} · Photo{' '}
          {(photo.order ?? 0) + 1}
        </p>
        <div ref={ref}>
          <StatusBadge status={photo.status} />
        </div>
        {photo.status === 'pending' && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className={photoButton}
              onClick={() => reviewPhoto(photo.schoolId, photo.id, 'rejected')}
            >
              <X aria-hidden="true" />
              Disapprove
            </Button>
            <Button
              className={photoButton}
              onClick={() => reviewPhoto(photo.schoolId, photo.id, 'approved')}
            >
              <Check aria-hidden="true" />
              Approve
            </Button>
          </div>
        )}
        {photo.latitude !== undefined && (
          <p className="text-xs text-muted-foreground">
            Reviewer location only: {photo.latitude.toFixed(6)},{' '}
            {photo.longitude?.toFixed(6)}
          </p>
        )}
      </div>
    </article>
  );
}
export function SiteUpdateReview({
  photos,
  school,
}: {
  photos: DemoPhoto[];
  school: PhotoSchool;
}) {
  const [preview, setPreview] = useState<DemoPhoto>();
  const [filter, setFilter] = useState('pending');
  const scoped = photos.filter((p) => p.schoolId === school.schoolId);
  const batches = groupSiteUpdates(scoped)
    .reverse()
    .filter(
      (batch) => filter === 'all' || batch.some((p) => p.status === filter),
    );
  const pending = scoped.filter((p) => p.status === 'pending').length;
  return (
    <div className="space-y-5">
      <SchoolContext school={school} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" aria-live="polite" className="text-sm font-semibold">
          {pending} {pending === 1 ? 'photo awaiting' : 'photos awaiting'}{' '}
          review
        </p>
        <label className="flex items-center gap-2 text-sm">
          Show
          <select
            className="min-h-11 rounded-xl border bg-background px-3"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="pending">Pending updates</option>
            <option value="all">All updates</option>
          </select>
        </label>
      </div>
      <p className="text-sm leading-6 text-muted-foreground">
        Review each photo individually. Only approved photos appear in Site
        Progress, even when other photos from the same visit are still pending
        or disapproved.
      </p>
      {batches.map((batch) => (
        <section
          key={batch[0].batchId ?? batch[0].id}
          className="space-y-4 rounded-2xl border bg-muted/30 p-4"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-700">
              {dateLabel(batch[0])}
              {!batch[0].dateTaken && ' · submission date'}
            </p>
            <h3 className="mt-1 break-words text-lg font-bold">
              {batch[0].title ||
                batch[0].stage ||
                batch[0].category ||
                'School site update'}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Submitted {new Date(batch[0].submittedAt).toLocaleString('en-PH')}{' '}
              · {batch[0].stage || batch[0].category || 'Stage not recorded'}
            </p>
            {batch[0].remarks && (
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">
                {batch[0].remarks}
              </p>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {batch.map((p) => (
              <ReviewPhoto key={p.id} photo={p} inspect={() => setPreview(p)} />
            ))}
          </div>
        </section>
      ))}
      {!batches.length && (
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          {filter === 'pending'
            ? 'No photos awaiting review.'
            : 'No site updates submitted yet.'}
        </p>
      )}
      <PhotoPreview
        photo={
          preview && {
            image: preview.image,
            label: `${school.schoolName} · ${dateLabel(preview)} · ${preview.viewpoint ?? 'Site photo'}`,
          }
        }
        onClose={() => setPreview(undefined)}
      />
    </div>
  );
}
