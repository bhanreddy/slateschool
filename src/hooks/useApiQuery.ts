import { useMemo } from 'react';
import { api } from '../services/apiClient';
import { usePersistedSWR, invalidatePersistedSWRCache } from './usePersistedSWR';

function serializeQuery(query?: UseApiQueryOptions['query']) {
  if (!query) return '';
  const cleanEntries = Object.entries(query)
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));

  return new URLSearchParams(
    cleanEntries.map(([key, value]) => [key, String(value)])
  ).toString();
}

export interface UseApiQueryOptions {
  enabled?: boolean;
  query?: Record<string, string | number | boolean | undefined>;
  persist?: boolean;
  revalidateOnMount?: boolean;
  /** When true, failed requests do not surface blocking alert dialogs. */
  silent?: boolean;
}

/**
 * Lightweight GET cache for staff/admin screens — stale-while-revalidate
 * semantics via usePersistedSWR. Set persist:true for cold-start disk cache.
 */
export function useApiQuery<T>(
  endpoint: string,
  cacheKeySuffix: string,
  ttlMs: number,
  userId: string | null | undefined,
  options: UseApiQueryOptions = {}
) {
  const { enabled = true, query, persist = false, revalidateOnMount = false, silent = false } = options;
  const queryKey = serializeQuery(query);
  const requestQuery = useMemo(() => {
    if (!queryKey) return undefined;
    return Object.fromEntries(new URLSearchParams(queryKey).entries());
  }, [queryKey]);

  const { data, loading, isRefreshing, error, refetch } = usePersistedSWR<T>({
    cacheKey: cacheKeySuffix,
    userId,
    ttlMs,
    enabled,
    persist,
    query: queryKey,
    revalidateOnMount,
    fetcher: () => api.get<T>(endpoint, requestQuery, { silent }),
  });

  return { data, loading, isRefreshing, error, refetch };
}

/** Drop cached GET results (memory + disk) so visibility changes apply immediately. */
export function invalidateApiQueryCache(cacheKeySuffix?: string) {
  invalidatePersistedSWRCache(cacheKeySuffix, true);
}
