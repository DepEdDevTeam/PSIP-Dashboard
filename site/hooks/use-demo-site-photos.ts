'use client';
import { useEffect, useSyncExternalStore } from 'react';
import {
  initializePhotos,
  snapshot,
  storageWarning,
  subscribe,
  type DemoPhoto,
} from '@/lib/demo-site-photos';
const empty: DemoPhoto[] = [];
export function useDemoSitePhotos(schoolId: string) {
  const all = useSyncExternalStore(subscribe, snapshot, () => empty);
  const warning = useSyncExternalStore(subscribe, storageWarning, () => '');
  useEffect(initializePhotos, []);
  return {
    photos: all
      .filter((p) => p.schoolId === schoolId)
      .sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt)),
    warning,
  };
}
