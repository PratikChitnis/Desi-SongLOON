interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

/**
 * Get-or-set cache with a TTL in milliseconds.
 * Returns cached data if still fresh; otherwise calls `fetcher`, stores the
 * result, and returns it.  Zero network cost on cache hits.
 */
export async function cached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key) as CacheEntry<T> | undefined;
  if (hit && hit.expiresAt > now) return hit.data;

  const data = await fetcher();
  store.set(key, { data, expiresAt: now + ttlMs });
  return data;
}

/** 24 hours in ms — the default TTL used throughout the app. */
export const DAY_MS = 24 * 60 * 60 * 1000;
