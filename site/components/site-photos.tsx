'use client';

import { useEffect, useId, useState } from 'react';
import { ArrowLeft, Camera, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AnimatedPhotoDialog as Dialog,
  AnimatedPhotoDialogContent as DialogContent,
} from '@/components/animated-photo-dialog';
import {
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useDemoSitePhotos } from '@/hooks/use-demo-site-photos';
import { SitePhotoSubmission } from './site-update-submission';
import { SiteProgressExplorer } from './site-progress-explorer';
import { SiteUpdateReview } from './site-update-review';
import {
  demoNotice,
  photoButton,
  photoDialog,
  returnToMap,
  type PhotoSchool,
} from './site-update-shared';
export { SitePhotoSubmission } from './site-update-submission';
export {
  demoNotice,
  photoButton,
  photoDialog,
  returnToMap,
  type PhotoSchool,
} from './site-update-shared';

export function SiteProgress({
  school,
  compact = false,
}: {
  school: PhotoSchool;
  compact?: boolean;
}) {
  const { photos, warning } = useDemoSitePhotos(school.schoolId);
  const [mode, setMode] = useState<'explore' | 'submit' | 'review' | null>(
    null,
  );
  const approved = photos.filter((p) => p.status === 'approved');
  return (
    <section
      id={compact ? undefined : 'site-progress'}
      className={
        compact
          ? 'mt-4 space-y-2'
          : 'mt-5 space-y-4 rounded-2xl border bg-card p-5 text-card-foreground shadow-sm'
      }
    >
      {!compact && (
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-blue-700">
            Community documentation
          </p>
          <h2 className="mt-1 text-xl font-bold">Site Progress</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Explore school visits through time and documented viewpoints.
          </p>
        </div>
      )}
      <Dialog
        open={mode !== null}
        onOpenChange={(open) => {
          if (!open) setMode(null);
        }}
      >
        <div className="flex flex-wrap gap-2">
          <DialogTrigger
            render={
              <Button
                className={photoButton}
                onClick={() => setMode('explore')}
              />
            }
          >
            <Camera aria-hidden="true" />
            View Site Progress
          </DialogTrigger>
          <Button
            variant="outline"
            className={photoButton}
            onClick={() => setMode('submit')}
          >
            Submit Site Update
          </Button>
        </div>
        <DialogContent
          className={
            mode === 'explore'
              ? 'max-h-[96dvh] overflow-y-auto rounded-2xl border border-white/15 bg-slate-950 p-4 text-white sm:max-w-[min(1200px,96vw)] sm:p-6 [&>[data-slot=dialog-close]]:size-11'
              : photoDialog
          }
        >
          <DialogTitle className="pr-12 text-xl font-bold">
            {mode === 'explore'
              ? school.schoolName
              : mode === 'review'
                ? 'Review Site Submissions'
                : 'Submit Site Update'}
          </DialogTitle>
          <DialogDescription
            className={mode === 'explore' ? 'text-slate-300' : ''}
          >
            {mode === 'explore'
              ? `Site Progress Explorer · School ID ${school.schoolId}${school.schoolLocation ? ` · ${school.schoolLocation}` : ''}`
              : mode === 'review'
                ? 'Demo reviewer mode · Local review controls, no official review.'
                : 'Document a school visit with photos and observations.'}
          </DialogDescription>
          {warning && (
            <p role="alert" className="text-sm">
              {warning}
            </p>
          )}
          {mode === 'explore' && (
            <>
              <div className="flex flex-wrap justify-between gap-2">
                <Button
                  variant="ghost"
                  className={`${photoButton} text-white hover:bg-white/10 hover:text-white`}
                  onClick={() => setMode(null)}
                >
                  <ArrowLeft aria-hidden="true" />
                  Map / previous view
                </Button>
                <Button
                  variant="ghost"
                  className={`${photoButton} text-white hover:bg-white/10 hover:text-white`}
                  onClick={() => setMode('review')}
                >
                  <ShieldCheck aria-hidden="true" />
                  Review Demo Submissions
                </Button>
              </div>
              <SiteProgressExplorer
                photos={photos}
                school={school}
                onSubmit={() => setMode('submit')}
                onClose={() => setMode(null)}
              />
            </>
          )}
          {mode === 'submit' && (
            <SitePhotoSubmission
              key={school.schoolId}
              school={school}
              onReturn={() => returnToMap(() => setMode(null))}
            />
          )}
          {mode === 'review' && (
            <>
              <Button
                variant="outline"
                className={`${photoButton} justify-self-start`}
                onClick={() => setMode('explore')}
              >
                <ArrowLeft aria-hidden="true" />
                Site Progress
              </Button>
              <SiteUpdateReview photos={photos} school={school} />
            </>
          )}
        </DialogContent>
      </Dialog>
      {!compact && (
        <>
          {approved.length ? (
            <p className="text-sm text-muted-foreground">
              {approved.length} reviewed{' '}
              {approved.length === 1 ? 'photo' : 'photos'} available. Open the
              explorer to follow progress.
            </p>
          ) : (
            <div className="rounded-xl border border-dashed bg-muted/30 p-6">
              <p className="font-semibold">No verified site updates yet.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Help document the current condition of this school project.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Community submissions are reviewed before appearing publicly.
              </p>
            </div>
          )}
          <Button
            variant="ghost"
            className={photoButton}
            onClick={() => setMode('review')}
          >
            <ShieldCheck aria-hidden="true" />
            Review Demo Submissions
          </Button>
          <p className="text-xs text-muted-foreground">{demoNotice}</p>
        </>
      )}
    </section>
  );
}

export function PhotoNavbar({
  schools,
  current,
}: {
  schools: PhotoSchool[];
  current?: PhotoSchool;
}) {
  const searchId = useId();
  const [open, setOpen] = useState(false);
  const [school, setSchool] = useState<PhotoSchool>();
  const [search, setSearch] = useState('');
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (
        ['#submit-site-photo', '#submit-site-update'].includes(
          window.location.hash,
        )
      )
        setOpen(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  const choices = Array.from(
    new Map(schools.map((s) => [s.schoolId, s])).values(),
  )
    .filter((s) =>
      `${s.schoolName} ${s.schoolId}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .slice(0, 30);
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        setSchool(current);
        setSearch('');
      }}
    >
      <DialogTrigger className="min-h-11 rounded-lg px-2 text-xs font-bold text-white hover:bg-white/15 focus-visible:outline-2 sm:px-3 sm:text-sm">
        <span className="sm:hidden">Site Update</span>
        <span className="hidden sm:inline">Submit Site Update</span>
      </DialogTrigger>
      <DialogContent className={photoDialog}>
        <DialogTitle className="pr-10 text-xl font-bold">
          Submit Site Update
        </DialogTitle>
        <DialogDescription>
          {school
            ? 'Document a visit to the selected school.'
            : 'Choose a school to document a site visit.'}
        </DialogDescription>
        {school ? (
          <>
            <Button
              variant="outline"
              className={`${photoButton} justify-self-start`}
              onClick={() => setSchool(undefined)}
            >
              Change School
            </Button>
            <SitePhotoSubmission
              key={school.schoolId}
              school={school}
              onReturn={() => returnToMap(() => setOpen(false))}
            />
          </>
        ) : (
          <div className="space-y-3">
            <label htmlFor={searchId} className="block space-y-2">
              <span className="font-semibold">School name or School ID</span>
              <Input
                id={searchId}
                className="min-h-11 text-base"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search schools"
              />
            </label>
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {choices.map((s) => (
                <Button
                  key={s.schoolId}
                  variant="outline"
                  className={`${photoButton} h-auto w-full justify-start whitespace-normal py-3 text-left`}
                  onClick={() => setSchool(s)}
                >
                  <span>
                    {s.schoolName}
                    <span className="block text-xs text-muted-foreground">
                      School ID {s.schoolId}
                      {s.schoolLocation && ` · ${s.schoolLocation}`}
                    </span>
                  </span>
                </Button>
              ))}
              {!choices.length && (
                <p className="p-4 text-sm">
                  {schools.length
                    ? 'No matching schools.'
                    : 'School data is not available yet. Try again after the dashboard loads.'}
                </p>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Showing up to 30 schools. Search to narrow the list.
            </p>
            <p className="text-xs text-muted-foreground">{demoNotice}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
