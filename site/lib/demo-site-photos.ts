'use client';

export const categories = [
  'Construction progress',
  'Completed site',
  'Maintenance concern',
  'Other',
] as const;
export type DemoPhoto = {
  id: string;
  schoolId: string;
  schoolName: string;
  image: string;
  remarks: string;
  category: string;
  submittedAt: string;
  latitude?: number;
  longitude?: number;
  status: 'pending' | 'approved' | 'rejected';
  source: 'community';
  batchId?: string;
  dateTaken?: string;
  stage?: string;
  title?: string;
  viewpoint?: string;
  order?: number;
  schoolLocation?: string;
};
export const stages = [
  'Site Preparation',
  'Foundation',
  'Structural Works',
  'Roofing',
  'Finishing',
  'Completed',
  'Maintenance / Issue',
  'Other',
] as const;
export const viewpoints = [
  'Front',
  'Left',
  'Right',
  'Rear',
  'Interior',
  'Classroom',
  'Construction Detail',
  'Other',
] as const;
export const MAX_BATCH_PHOTOS = 8;
export function validDateTaken(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
const KEY = 'ppp.demo.site-photos.v1';
const MAX_RECORDS = 40;
let records: DemoPhoto[] = [];
let initialized = false;
let warning = '';
const listeners = new Set<() => void>();
export const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const snapshot = () => records;
export const storageWarning = () => warning;
function emit() {
  listeners.forEach((listener) => listener());
}
function valid(value: unknown): value is DemoPhoto {
  if (!value || typeof value !== 'object') return false;
  const p = value as DemoPhoto;
  return (
    [
      'id',
      'schoolId',
      'schoolName',
      'remarks',
      'category',
      'submittedAt',
    ].every((k) => typeof p[k as keyof DemoPhoto] === 'string') &&
    !!p.id &&
    !!p.schoolId &&
    p.remarks.length <= 500 &&
    p.schoolName.length <= 1000 &&
    (p.category === '' || categories.some((c) => c === p.category)) &&
    typeof p.image === 'string' &&
    p.image.length <= 800_000 &&
    /^data:image\/(jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(p.image) &&
    Number.isFinite(Date.parse(p.submittedAt)) &&
    ['pending', 'approved', 'rejected'].includes(p.status) &&
    p.source === 'community' &&
    (p.batchId === undefined ||
      (typeof p.batchId === 'string' &&
        p.batchId.length > 0 &&
        p.batchId.length <= 100)) &&
    (p.dateTaken === undefined ||
      (typeof p.dateTaken === 'string' && validDateTaken(p.dateTaken))) &&
    (p.stage === undefined || stages.some((s) => s === p.stage)) &&
    (p.viewpoint === undefined || viewpoints.some((v) => v === p.viewpoint)) &&
    (p.title === undefined ||
      (typeof p.title === 'string' && p.title.length <= 100)) &&
    (p.schoolLocation === undefined ||
      (typeof p.schoolLocation === 'string' &&
        p.schoolLocation.length <= 1000)) &&
    (p.order === undefined ||
      (Number.isInteger(p.order) &&
        p.order >= 0 &&
        p.order < MAX_BATCH_PHOTOS)) &&
    ((p.latitude === undefined && p.longitude === undefined) ||
      (typeof p.latitude === 'number' &&
        Number.isFinite(p.latitude) &&
        Math.abs(p.latitude) <= 90 &&
        typeof p.longitude === 'number' &&
        Number.isFinite(p.longitude) &&
        Math.abs(p.longitude) <= 180))
  );
}
export function initializePhotos() {
  if (initialized) return;
  initialized = true;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) {
      if (raw.length > 32_000_000) throw new Error('Too large');
      const parsed: unknown = JSON.parse(raw);
      if (
        !Array.isArray(parsed) ||
        parsed.length > MAX_RECORDS ||
        !parsed.every(valid) ||
        new Set(parsed.map((p) => p.id)).size !== parsed.length
      )
        throw new Error('Invalid data');
      records = parsed;
    }
  } catch {
    warning =
      'Saved demo data could not be read. You can start a new local demo.';
  }
  emit();
}
function persist() {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(records));
    warning = '';
  } catch {
    // Remove stale persisted statuses so a reload cannot silently undo a review.
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* Browser storage may be disabled. */
    }
    warning =
      'Browser storage is full or unavailable. Demo photos remain available while this page is open, but may be lost on refresh.';
  }
  emit();
}
export function addPhoto(
  input: Omit<DemoPhoto, 'id' | 'status' | 'source' | 'submittedAt'>,
) {
  initializePhotos();
  if (records.length >= MAX_RECORDS)
    throw new Error(
      'This demo holds up to 40 photos. Close this tab and start a new session to reset it.',
    );
  const photo: DemoPhoto = {
    ...input,
    id:
      globalThis.crypto?.randomUUID?.() ??
      `photo-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    status: 'pending',
    source: 'community',
    submittedAt: new Date().toISOString(),
  };
  if (!valid(photo))
    throw new Error(
      'This photo could not be saved. Please choose another image.',
    );
  records = [photo, ...records];
  persist();
}
export function reviewPhoto(
  schoolId: string,
  id: string,
  status: 'approved' | 'rejected',
) {
  initializePhotos();
  records = records.map((p) =>
    p.schoolId === schoolId && p.id === id && p.status === 'pending'
      ? { ...p, status }
      : p,
  );
  persist();
}

// Prepare and validate the entire visit before publishing any records to the store.
// Moderation remains independent for every photo through reviewPhoto above.
export function addSiteUpdate(input: {
  schoolId: string;
  schoolName: string;
  schoolLocation?: string;
  latitude?: number;
  longitude?: number;
  dateTaken: string;
  stage: string;
  title: string;
  remarks: string;
  photos: { image: string; viewpoint: string }[];
}) {
  initializePhotos();
  if (!input.photos.length || input.photos.length > MAX_BATCH_PHOTOS)
    throw new Error(
      `Add between 1 and ${MAX_BATCH_PHOTOS} photos per site update.`,
    );
  if (records.length + input.photos.length > MAX_RECORDS)
    throw new Error(
      `This demo holds 40 photos. There is room for ${MAX_RECORDS - records.length} more in this session.`,
    );
  const batchId = globalThis.crypto.randomUUID();
  const submittedAt = new Date().toISOString();
  const { photos, ...details } = input;
  const additions: DemoPhoto[] = photos.map((photo, order) => ({
    ...details,
    ...photo,
    order,
    batchId,
    submittedAt,
    id: globalThis.crypto.randomUUID(),
    category: '',
    status: 'pending',
    source: 'community',
  }));
  if (!additions.every(valid))
    throw new Error('Check the date, stage, and photos before submitting.');
  records = [...additions, ...records];
  persist();
}

export function groupSiteUpdates(photos: DemoPhoto[]) {
  const groups = new Map<string, DemoPhoto[]>();
  photos.forEach((photo) => {
    const key = `${photo.schoolId}:${photo.batchId ?? photo.id}`;
    groups.set(key, [...(groups.get(key) ?? []), photo]);
  });
  return Array.from(groups.values())
    .map((batch) => batch.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)))
    .sort(
      (a, b) =>
        (a[0].dateTaken ?? a[0].submittedAt).localeCompare(
          b[0].dateTaken ?? b[0].submittedAt,
        ) || a[0].submittedAt.localeCompare(b[0].submittedAt),
    );
}
export async function optimizePhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/') || /svg/i.test(file.type))
    throw new Error('Choose a photo such as JPEG, PNG, or WebP.');
  if (file.size > 25 * 1024 * 1024)
    throw new Error('Choose an image smaller than 25 MB.');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    if (
      !img.naturalWidth ||
      !img.naturalHeight ||
      img.naturalWidth * img.naturalHeight > 80_000_000
    )
      throw new Error('Image dimensions are too large.');
    const scale = Math.min(
      1,
      1280 / Math.max(img.naturalWidth, img.naturalHeight),
    );
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Image processing unavailable.');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.78, 0.6, 0.4]) {
      const result = canvas.toDataURL('image/jpeg', quality);
      if (result.length <= 800_000) return result;
    }
    throw new Error('Please choose a smaller or simpler image.');
  } catch (error) {
    throw new Error(
      error instanceof Error && error.message.startsWith('Please')
        ? error.message
        : 'This image could not be processed. Try a JPEG, PNG, or WebP photo.',
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
