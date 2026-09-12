'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  ImagePlus,
  MapPin,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  addSiteUpdate,
  MAX_BATCH_PHOTOS,
  optimizePhoto,
  stages,
  storageWarning,
  validDateTaken,
  viewpoints,
} from '@/lib/demo-site-photos';
import {
  demoNotice,
  field,
  PhotoPreview,
  photoButton,
  SchoolContext,
  type PhotoSchool,
} from './site-update-shared';

type DraftPhoto = { id: string; image: string; viewpoint: string };
const steps = ['Site information', 'Add photos', 'Details', 'Review'];
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function SitePhotoSubmission({
  school,
  onSaved,
  onReturn,
}: {
  school: PhotoSchool;
  onSaved?: (message: string) => void;
  onReturn: () => void;
}) {
  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const [dateTaken, setDateTaken] = useState(today);
  const [stage, setStage] = useState('');
  const [title, setTitle] = useState('');
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [warning, setWarning] = useState('');
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<DraftPhoto>();
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  }>();
  const [locationMessage, setLocationMessage] = useState('');
  const [locating, setLocating] = useState(false);
  const gallery = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const replacement = useRef<HTMLInputElement>(null);
  const replaceId = useRef('');
  const processing = useRef(false);
  const submitted = useRef(false);
  const generation = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  useEffect(() => {
    heading.current?.focus();
  }, [step, saved]);
  function locate() {
    if (!navigator.geolocation) {
      setLocationMessage(
        'Location is unavailable. You can continue without it.',
      );
      return;
    }
    const token = generation.current;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (result) => {
        if (token !== generation.current) return;
        setLocation({
          latitude: result.coords.latitude,
          longitude: result.coords.longitude,
        });
        setLocationMessage('Location added for local reviewer use only.');
        setLocating(false);
      },
      () => {
        if (token !== generation.current) return;
        setLocationMessage(
          'Location could not be accessed. You can continue without it.',
        );
        setLocating(false);
      },
      { timeout: 10000, maximumAge: 0, enableHighAccuracy: false },
    );
  }

  async function addFiles(files: File[], replacing?: string) {
    if (!files.length || processing.current) return;
    if (!replacing && photos.length + files.length > MAX_BATCH_PHOTOS) {
      setError(`You can add up to ${MAX_BATCH_PHOTOS} photos per update.`);
      return;
    }
    const token = generation.current;
    processing.current = true;
    setBusy(true);
    setError('');
    try {
      const additions: DraftPhoto[] = [];
      for (const file of files)
        additions.push({
          id: crypto.randomUUID(),
          image: await optimizePhoto(file),
          viewpoint: 'Other',
        });
      if (token !== generation.current) return;
      setPhotos((current) =>
        replacing
          ? current.map((p) =>
              p.id === replacing ? { ...p, image: additions[0].image } : p,
            )
          : [...current, ...additions],
      );
    } catch (cause) {
      if (token === generation.current)
        setError(
          cause instanceof Error
            ? cause.message
            : 'Could not prepare these photos.',
        );
    } finally {
      processing.current = false;
      if (token === generation.current) setBusy(false);
    }
  }
  function move(index: number, direction: number) {
    setPhotos((current) => {
      const next = [...current];
      [next[index], next[index + direction]] = [
        next[index + direction],
        next[index],
      ];
      return next;
    });
  }
  function advance() {
    setError('');
    if (!validDateTaken(dateTaken) || dateTaken > today() || !stage) {
      setError(
        'Choose a date taken (today or earlier) and a construction stage.',
      );
      return;
    }
    if (step === 1 && !photos.length) {
      setError('Add at least one photo to continue.');
      return;
    }
    setStep(step + 1);
  }
  if (saved)
    return (
      <div className="space-y-5 py-5 text-center">
        <CheckCircle2
          className="mx-auto size-14 text-emerald-600"
          aria-hidden="true"
        />
        <h2 ref={heading} tabIndex={-1} className="text-2xl font-bold">
          Site update submitted
        </h2>
        <span className="inline-block rounded-full bg-amber-100 px-4 py-2 text-xs font-bold tracking-wider text-amber-900">
          PENDING REVIEW
        </span>
        <p className="mx-auto max-w-md text-base leading-7">
          Your submission will be reviewed before it appears in the public Site
          Progress view.
        </p>
        <p className="text-sm text-muted-foreground">
          {photos.length} photos · {school.schoolName}
          <br />
          Each photo is reviewed individually.
        </p>
        {warning && (
          <p role="alert" className="text-sm text-amber-800">
            {warning}
          </p>
        )}
        <p className="text-sm text-muted-foreground">{demoNotice}</p>
        <Button className={photoButton} onClick={onReturn}>
          <ArrowLeft aria-hidden="true" />
          Return to Map
        </Button>
      </div>
    );

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (step !== 3) {
          advance();
          return;
        }
        if (busy || submitted.current) return;
        submitted.current = true;
        try {
          addSiteUpdate({
            ...school,
            ...location,
            dateTaken,
            stage,
            title: title.trim(),
            remarks: remarks.trim(),
            photos,
          });
          setWarning(storageWarning());
          setSaved(true);
          onSaved?.('Site update submitted — pending review.');
        } catch (cause) {
          submitted.current = false;
          setError(
            cause instanceof Error
              ? cause.message
              : 'Unable to save this update.',
          );
        }
      }}
    >
      <ol
        aria-label="Submission steps"
        className="grid grid-cols-4 gap-2 border-b pb-5"
      >
        {steps.map((label, i) => (
          <li
            key={label}
            aria-current={i === step ? 'step' : undefined}
            className={`min-w-0 text-xs ${i === step ? 'font-bold text-blue-700' : 'text-muted-foreground'}`}
          >
            <span
              className={`mb-2 flex size-8 items-center justify-center rounded-full ${i <= step ? 'bg-blue-700 text-white' : 'bg-muted'}`}
            >
              {i < step ? (
                <Check className="size-4" aria-hidden="true" />
              ) : (
                `0${i + 1}`
              )}
            </span>
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">
              {['Site', 'Photos', 'Details', 'Review'][i]}
            </span>
          </li>
        ))}
      </ol>
      <SchoolContext school={school} />
      <div>
        <h2
          ref={heading}
          tabIndex={-1}
          className="text-xl font-bold outline-none"
        >
          {
            [
              'Document a site visit',
              'Show the site from different views',
              'Tell us what changed',
              'Review your site update',
            ][step]
          }
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {
            [
              'This update documents the school as a whole.',
              'Add up to 8 photos. Choose the viewpoint that best describes each image.',
              'Add context to help reviewers understand your photos.',
              'Check the details below. Your photos will enter review individually.',
            ][step]
          }
        </p>
      </div>
      {(step === 0 || step === 2) && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-semibold">Date photo was taken</span>
            <Input
              type="date"
              className={field}
              value={dateTaken}
              max={today()}
              required
              onChange={(e) => setDateTaken(e.target.value)}
            />
            <span className="text-xs text-muted-foreground">
              Use one visit date for all photos in this update.
            </span>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold">
              Construction stage / observation
            </span>
            <select
              className={field}
              value={stage}
              required
              onChange={(e) => setStage(e.target.value)}
            >
              <option value="">Select a stage</option>
              {stages.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
      )}
      {step === 1 && (
        <>
          <input
            ref={gallery}
            className="hidden"
            type="file"
            multiple
            accept="image/*"
            aria-label="Add site photos"
            onChange={(e) => {
              void addFiles(Array.from(e.target.files ?? []));
              e.target.value = '';
            }}
          />
          <input
            ref={camera}
            className="hidden"
            type="file"
            accept="image/*"
            capture="environment"
            aria-label="Take site photo"
            onChange={(e) => {
              void addFiles(Array.from(e.target.files ?? []));
              e.target.value = '';
            }}
          />
          <input
            ref={replacement}
            className="hidden"
            type="file"
            accept="image/*"
            aria-label="Replace site photo"
            onChange={(e) => {
              void addFiles(
                Array.from(e.target.files ?? []),
                replaceId.current,
              );
              e.target.value = '';
            }}
          />
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void addFiles(Array.from(e.dataTransfer.files));
            }}
            className={`rounded-2xl border-2 border-dashed px-4 py-8 text-center ${dragging ? 'border-blue-600 bg-blue-100' : 'border-blue-200 bg-blue-50/50'}`}
          >
            <Upload
              className="mx-auto mb-3 size-8 text-blue-700"
              aria-hidden="true"
            />
            <p className="text-lg font-semibold">Add photos from this site</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Drag photos here or browse your device
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button
                type="button"
                className={photoButton}
                disabled={busy}
                onClick={() => gallery.current?.click()}
              >
                <ImagePlus aria-hidden="true" />
                Browse photos
              </Button>
              <Button
                type="button"
                variant="outline"
                className={photoButton}
                disabled={busy}
                onClick={() => camera.current?.click()}
              >
                <Camera aria-hidden="true" />
                Take photo
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              JPEG, PNG or WebP · Up to 25 MB each · Optimized for this demo
            </p>
          </div>
          <p role="status" className="text-sm text-muted-foreground">
            {busy
              ? 'Preparing photos…'
              : `${photos.length} of ${MAX_BATCH_PHOTOS} photos added`}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {photos.map((p, i) => (
              <article key={p.id} className="overflow-hidden rounded-xl border">
                <button
                  type="button"
                  className="block w-full focus-visible:outline-2 focus-visible:outline-blue-600"
                  onClick={() => setPreview(p)}
                  aria-label={`Preview photo ${i + 1}`}
                >
                  <Image
                    unoptimized
                    src={p.image}
                    width={640}
                    height={480}
                    alt={`Selected site photo ${i + 1}: ${p.viewpoint}`}
                    className="h-40 w-full bg-muted object-contain"
                  />
                </button>
                <div className="space-y-3 p-3">
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold">
                      Photo {i + 1} viewpoint
                    </span>
                    <select
                      aria-label={`Photo ${i + 1} viewpoint`}
                      className={field}
                      value={p.viewpoint}
                      onChange={(e) =>
                        setPhotos(
                          photos.map((photo) =>
                            photo.id === p.id
                              ? { ...photo, viewpoint: e.target.value }
                              : photo,
                          ),
                        )
                      }
                    >
                      {viewpoints.map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <div className="flex flex-wrap gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={busy}
                      className="min-h-11"
                      onClick={() => {
                        replaceId.current = p.id;
                        replacement.current?.click();
                      }}
                    >
                      Replace
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={busy}
                      className="min-h-11"
                      onClick={() =>
                        setPhotos(photos.filter((photo) => photo.id !== p.id))
                      }
                    >
                      Remove
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="size-11"
                      disabled={i === 0 || busy}
                      aria-label={`Move photo ${i + 1} earlier`}
                      onClick={() => move(i, -1)}
                    >
                      <ArrowLeft aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="size-11"
                      disabled={i === photos.length - 1 || busy}
                      aria-label={`Move photo ${i + 1} later`}
                      onClick={() => move(i, 1)}
                    >
                      <ArrowRight aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
      {step === 2 && (
        <>
          <label className="block space-y-2">
            <span className="text-sm font-semibold">
              Site update title{' '}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </span>
            <Input
              className={field}
              maxLength={100}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Second-floor construction underway"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold">
              Notes / observations{' '}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </span>
            <Textarea
              className="min-h-28 text-base"
              maxLength={500}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="What did you observe during this visit?"
            />
            <span className="text-xs text-muted-foreground">
              {remarks.length}/500 characters
            </span>
          </label>
        </>
      )}
      {step === 2 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Visit location (optional)</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className={photoButton}
              disabled={locating}
              onClick={locate}
            >
              <MapPin aria-hidden="true" />
              {locating ? 'Finding location…' : 'Use Current Location'}
            </Button>
            {location && (
              <Button
                type="button"
                variant="ghost"
                className={photoButton}
                onClick={() => {
                  setLocation(undefined);
                  setLocationMessage('Location removed.');
                }}
              >
                Remove location
              </Button>
            )}
          </div>
          <p role="status" className="text-xs text-muted-foreground">
            {locationMessage || 'Shared only with the local demo reviewer.'}
          </p>
        </div>
      )}
      {step === 3 && (
        <div className="space-y-4">
          <div className="rounded-xl bg-muted/40 p-4">
            <h3 className="break-words text-lg font-semibold">
              {title || 'School site update'}
            </h3>
            <p className="mt-1 text-sm">
              {dateTaken} · {stage}
            </p>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm text-muted-foreground">
              {remarks || 'No additional observations.'}
            </p>
            {location && (
              <p className="mt-2 text-xs text-muted-foreground">
                Reviewer-only location: {location.latitude.toFixed(6)},{' '}
                {location.longitude.toFixed(6)}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {photos.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPreview(p)}
                className="overflow-hidden rounded-xl border text-left"
                aria-label={`Preview photo ${i + 1}`}
              >
                <Image
                  unoptimized
                  src={p.image}
                  width={320}
                  height={240}
                  alt={`Photo ${i + 1}: ${p.viewpoint}`}
                  className="aspect-[4/3] w-full bg-muted object-contain"
                />
                <span className="block p-2 text-xs font-semibold">
                  {i + 1}. {p.viewpoint}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex gap-3 rounded-xl bg-blue-50 p-3 text-sm leading-6 text-blue-950">
        <ShieldCheck className="mt-1 size-5 shrink-0" aria-hidden="true" />
        <p>
          Community submissions are reviewed before appearing publicly. Avoid
          faces and personal information.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex items-center justify-between gap-3 border-t pt-4">
        <Button
          type="button"
          variant="outline"
          className={photoButton}
          disabled={step === 0 || busy}
          onClick={() => {
            setStep(step - 1);
            setError('');
          }}
        >
          <ArrowLeft aria-hidden="true" />
          Back
        </Button>
        <Button type="submit" className={photoButton} disabled={busy}>
          {step === 3 ? 'Submit Site Update' : 'Continue'}
          <ArrowRight aria-hidden="true" />
        </Button>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">{demoNotice}</p>
      <PhotoPreview
        photo={
          preview && {
            image: preview.image,
            label: `${school.schoolName} · ${preview.viewpoint}`,
          }
        }
        onClose={() => setPreview(undefined)}
      />
    </form>
  );
}
