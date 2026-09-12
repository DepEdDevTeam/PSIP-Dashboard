'use client';

import Image from 'next/image';
import {
  AnimatedPhotoDialog as Dialog,
  AnimatedPhotoDialogContent as DialogContent,
} from '@/components/animated-photo-dialog';
import { DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { DemoPhoto } from '@/lib/demo-site-photos';

export type PhotoSchool = {
  schoolId: string;
  schoolName: string;
  schoolLocation?: string;
};
export const photoButton = 'min-h-11 gap-2 rounded-xl px-4 text-sm';
export const photoDialog =
  'max-h-[92dvh] overflow-y-auto rounded-2xl p-5 sm:max-w-3xl [&>[data-slot=dialog-close]]:size-11';
export const field =
  'min-h-11 w-full rounded-xl border bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600';
export const demoNotice =
  'Demo only — photos stay in this browser tab and are not sent to DepEd. They are cleared when the session ends.';
export const statusLabels = {
  pending: 'Awaiting Review',
  approved: 'Verified for Display',
  rejected: 'Not Published',
};
export function returnToMap(close: () => void) {
  close();
  if (document.querySelector('.mapboxgl-map')) return;
  const url = new URL(window.location.href);
  url.pathname = '/dashboard';
  url.searchParams.set('view', 'map');
  url.hash = '';
  window.location.assign(url.toString());
}
export function dateLabel(photo: DemoPhoto) {
  return new Date(
    photo.dateTaken ? `${photo.dateTaken}T12:00:00` : photo.submittedAt,
  ).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
export function StatusBadge({ status }: { status: DemoPhoto['status'] }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${status === 'approved' ? 'bg-emerald-100 text-emerald-900' : status === 'pending' ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700'}`}
    >
      {statusLabels[status]}
    </span>
  );
}
export function SchoolContext({ school }: { school: PhotoSchool }) {
  return (
    <div className="rounded-xl border bg-muted/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        School-wide site update
      </p>
      <p className="mt-1 text-lg font-bold">{school.schoolName}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        School ID {school.schoolId}
        {school.schoolLocation && ` · ${school.schoolLocation}`}
      </p>
    </div>
  );
}
export function PhotoPreview({
  photo,
  onClose,
}: {
  photo?: { image: string; label: string };
  onClose: () => void;
}) {
  return (
    <Dialog
      open={!!photo}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[94dvh] overflow-y-auto rounded-2xl sm:max-w-5xl">
        <DialogTitle className="pr-10">Photo preview</DialogTitle>
        <DialogDescription>{photo?.label}</DialogDescription>
        {photo && (
          <Image
            unoptimized
            src={photo.image}
            width={1280}
            height={960}
            alt={photo.label}
            className="max-h-[75dvh] w-full object-contain"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
