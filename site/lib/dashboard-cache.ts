// IndexedDB avoids localStorage's small, synchronous JSON storage limit.
export const DASHBOARD_CACHE_TTL_MS = 30 * 60 * 1000;
const DATABASE = 'psip-dashboard';
const STORE = 'responses';
const KEY = 'dashboard-v2';

export type CacheEntry<T> = { expiresAt: number; data: T };

async function accessCache<T>(entry?: CacheEntry<T>): Promise<CacheEntry<T> | null> {
  if (typeof window === 'undefined') return null;
  return new Promise((resolve) => {
    let database: IDBDatabase | undefined;
    let finished = false;
    const finish = (value: CacheEntry<T> | null) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      database?.close();
      resolve(value);
    };
    // Blocked storage must never hold up the network request indefinitely.
    const timeout = setTimeout(() => finish(null), 1000);
    try {
      const open = window.indexedDB.open(DATABASE, 1);
      open.onupgradeneeded = () => {
        if (!open.result.objectStoreNames.contains(STORE)) open.result.createObjectStore(STORE);
      };
      open.onerror = () => finish(null);
      open.onblocked = () => finish(null);
      open.onsuccess = () => {
        database = open.result;
        if (finished) { database.close(); return; }
        database.onversionchange = () => database?.close();
        try {
          const transaction = database.transaction(STORE, entry ? 'readwrite' : 'readonly');
          const store = transaction.objectStore(STORE);
          const request = entry ? store.put(entry, KEY) : store.get(KEY);
          transaction.oncomplete = () => finish(entry ?? request.result ?? null);
          transaction.onerror = () => finish(null);
          transaction.onabort = () => finish(null);
        } catch { finish(null); }
      };
    } catch { finish(null); }
  });
}

export function readDashboardCache<T>() {
  return accessCache<T>();
}

export async function writeDashboardCache<T>(entry: CacheEntry<T>) {
  await accessCache(entry);
}
