import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { SCHOOL_ID } from '../constants/school';
import { persistentQueryCache } from '../services/persistentQueryCache';

type CacheEntry<T> = { data: T; storedAt: number };

const memoryCache = new Map<string, CacheEntry<unknown>>();
const fetchGeneration = new Map<string, number>();

function buildMemoryKey(schoolId: number, userKey: string, cacheKey: string, queryKey: string) {
  return `${schoolId}:${userKey}:${cacheKey}${queryKey ? `?${queryKey}` : ''}`;
}

export interface UsePersistedSWROptions<T> {
  cacheKey: string;
  userId: string | null | undefined;
  ttlMs: number;
  fetcher: () => Promise<T>;
  enabled?: boolean;
  persist?: boolean;
  query?: string;
  /** Always network-fetch on mount (e.g. driver trip safety). */
  revalidateOnMount?: boolean;
}

export function usePersistedSWR<T>({
  cacheKey,
  userId,
  ttlMs,
  fetcher,
  enabled = true,
  persist = false,
  query: queryKey = '',
  revalidateOnMount = false,
}: UsePersistedSWROptions<T>) {
  const isFocused = useIsFocused();
  const userKey = userId || 'anon';
  const memoryKey = useMemo(
    () => buildMemoryKey(SCHOOL_ID, userKey, cacheKey, queryKey),
    [userKey, cacheKey, queryKey],
  );

  const [data, setData] = useState<T | null>(() => {
    const hit = memoryCache.get(memoryKey) as CacheEntry<T> | undefined;
    return hit?.data ?? null;
  });
  const [loading, setLoading] = useState(!data && enabled && !!userId);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const hydratedRef = useRef(false);
  const mountedRef = useRef(true);

  // Consumers pass inline fetchers; a ref keeps runFetch's identity stable so
  // the fetch effects below run per focus/key change, not per render (an
  // unstable fetcher + revalidateOnMount would otherwise loop forever).
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Seed from memory on key change
  useEffect(() => {
    const hit = memoryCache.get(memoryKey) as CacheEntry<T> | undefined;
    if (hit) {
      setData(hit.data);
      setLoading(false);
    } else {
      setData(null);
      setLoading(enabled && !!userId);
    }
    hydratedRef.current = false;
  }, [memoryKey, enabled, userId]);

  // Cancel in-flight fetches when this hook becomes disabled (e.g. portal switch).
  useEffect(() => {
    if (!enabled) {
      fetchGeneration.set(memoryKey, (fetchGeneration.get(memoryKey) ?? 0) + 1);
    }
  }, [enabled, memoryKey]);

  const runFetch = useCallback(
    async (opts: { force?: boolean; background?: boolean } = {}) => {
      const { force = false, background = false } = opts;
      if (!enabled || !userId) return null;

      const hit = memoryCache.get(memoryKey) as CacheEntry<T> | undefined;
      const isStale = !hit || Date.now() - hit.storedAt >= ttlMs;

      if (!force && hit && !isStale && !revalidateOnMount) {
        setData(hit.data);
        setLoading(false);
        return hit.data;
      }

      const gen = (fetchGeneration.get(memoryKey) ?? 0) + 1;
      fetchGeneration.set(memoryKey, gen);

      if (background || hit) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const result = await fetcherRef.current();
        if (fetchGeneration.get(memoryKey) !== gen) return null;

        const storedAt = Date.now();
        memoryCache.set(memoryKey, { data: result as unknown, storedAt });
        setData(result);

        if (persist) {
          persistentQueryCache.write(userId, cacheKey, result, storedAt, queryKey);
        }
        return result;
      } catch (e: unknown) {
        if (fetchGeneration.get(memoryKey) !== gen) return null;
        const err = e instanceof Error ? e : new Error(String((e as any)?.message || e));
        setError(err);
        // Keep existing data on revalidate failure
        return hit?.data ?? null;
      } finally {
        if (fetchGeneration.get(memoryKey) === gen && mountedRef.current) {
          setLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [enabled, userId, memoryKey, ttlMs, persist, cacheKey, queryKey, revalidateOnMount],
  );

  // Disk hydration on memory miss
  useEffect(() => {
    if (!enabled || !userId || !persist || hydratedRef.current) return;

    const memHit = memoryCache.get(memoryKey) as CacheEntry<T> | undefined;
    if (memHit) {
      hydratedRef.current = true;
      return;
    }

    let cancelled = false;
    (async () => {
      const diskHit = await persistentQueryCache.read<T>(userId, cacheKey, queryKey);
      if (cancelled) return;
      if (!diskHit) {
        hydratedRef.current = true;
        // No persisted copy on disk (e.g. a cold web reload with an empty
        // cache). The focus-gated effect already bailed out waiting for
        // hydration and won't re-run on its own now that hydration is done,
        // so kick off the initial network fetch here. We do NOT gate this on
        // isFocused: an enabled hook with no data at all always needs to load
        // (isFocused can report false on web), otherwise the cards stay stuck
        // on their loading placeholder ("—") forever.
        void runFetch({ force: false, background: false });
        return;
      }

      const networkHit = memoryCache.get(memoryKey) as CacheEntry<T> | undefined;
      if (networkHit && networkHit.storedAt >= diskHit.storedAt) {
        hydratedRef.current = true;
        return;
      }

      memoryCache.set(memoryKey, { data: diskHit.data as unknown, storedAt: diskHit.storedAt });
      setData(diskHit.data);
      setLoading(false);
      hydratedRef.current = true;

      if (isFocused) void runFetch({ force: true, background: true });
    })();

    return () => { cancelled = true; };
  }, [enabled, userId, persist, memoryKey, cacheKey, queryKey, isFocused, runFetch]);

  // Focus-gated fetch / stale revalidation
  useEffect(() => {
    if (!enabled || !userId || !isFocused) return;

    const hit = memoryCache.get(memoryKey) as CacheEntry<T> | undefined;
    const isStale = !hit || Date.now() - hit.storedAt >= ttlMs;

    if (!hit) {
      if (persist && !hydratedRef.current) return;
      void runFetch({ force: false, background: false });
    } else if (isStale || revalidateOnMount) {
      void runFetch({ force: true, background: true });
    }
  }, [enabled, userId, isFocused, memoryKey, ttlMs, runFetch, persist, revalidateOnMount]);

  const refetch = useCallback(() => {
    const hit = memoryCache.get(memoryKey);
    return runFetch({ force: true, background: !!hit });
  }, [memoryKey, runFetch]);

  return { data, loading, isRefreshing, error, refetch };
}

/** Drop in-memory SWR entries. Optionally also purge matching disk keys. */
export function invalidatePersistedSWRCache(cacheKeySuffix?: string, purgeDisk = true) {
  if (!cacheKeySuffix) {
    memoryCache.clear();
    if (purgeDisk) void persistentQueryCache.removeMatching();
    return;
  }
  const suffix = `:${cacheKeySuffix}`;
  for (const key of memoryCache.keys()) {
    if (key.endsWith(suffix) || key.includes(`${suffix}?`)) {
      memoryCache.delete(key);
    }
  }
  if (purgeDisk) void persistentQueryCache.removeMatching(undefined, cacheKeySuffix);
}
