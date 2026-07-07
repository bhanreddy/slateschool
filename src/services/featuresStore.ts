/**
 * featuresStore — per-school STUDENT feature flags.
 *
 * The app has no zustand dependency, so this is a tiny module store exposed to
 * React via useSyncExternalStore (see hooks/useFeatures.ts). Same shape as a
 * zustand store (subscribe / getSnapshot / actions) without the extra package.
 *
 * Fail-safe: fetch failures keep the last-known-good cache, or registry
 * defaults. The app never blanks because flags didn't load.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { api } from './apiClient';
import { FEATURE_DEFAULTS, FeatureMap } from '../config/featureFlags';

const CACHE_KEY = 'student_features_cache_v1';
const TTL_MS = 5 * 60 * 1000; // short TTL; foreground/pull-to-refresh force a refetch

type State = {
  features: FeatureMap;
  loading: boolean;
  loaded: boolean;   // true once we have any value (cache, network, or defaults)
  fetchedAt: number;
  /** Prevents a late AsyncStorage hydrate from overwriting a fresher network fetch. */
  source: 'defaults' | 'cache' | 'network';
};

let state: State = {
  features: { ...FEATURE_DEFAULTS },
  loading: false,
  loaded: false,
  fetchedAt: 0,
  source: 'defaults',
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const setState = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  emit();
};

/** Network wins over cache; never let a stale hydrate clobber a fresh fetch. */
const shouldApplyCache = (cachedAt: number) =>
  state.source !== 'network' && cachedAt >= state.fetchedAt;

export const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const getSnapshot = (): State => state;

// Hydrate last-known-good cache once at module load (before first network call).
(async () => {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const cached = JSON.parse(raw);
      if (cached?.features && shouldApplyCache(cached.fetchedAt || 0)) {
        setState({
          features: { ...FEATURE_DEFAULTS, ...cached.features },
          loaded: true,
          fetchedAt: cached.fetchedAt || 0,
          source: 'cache',
        });
      }
    }
  } catch {
    // ignore — defaults stand
  }
})();

let inflight: Promise<void> | null = null;

/** Fetch effective flags. Skips network if fresh (unless force). Auth via apiClient (Supabase session). */
export async function fetchFeatures(opts?: { force?: boolean }): Promise<void> {
  if (inflight) return inflight;
  if (!opts?.force && state.loaded && Date.now() - state.fetchedAt < TTL_MS) return;

  setState({ loading: true });
  inflight = (async () => {
    try {
      const res = await api.get<{ features: FeatureMap }>('/me/features', undefined, { silent: true });
      const features = { ...FEATURE_DEFAULTS, ...(res?.features || {}) };
      const fetchedAt = Date.now();
      setState({ features, loading: false, loaded: true, fetchedAt, source: 'network' });
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ features, fetchedAt })).catch(() => {});
    } catch {
      // Fail safe: keep last-known-good/defaults. Mark loaded so UI leaves the skeleton.
      setState({ loading: false, loaded: true });
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Manual refetch (pull-to-refresh). */
export const refresh = () => fetchFeatures({ force: true });

/** Clear on logout so the next user doesn't inherit these flags. */
export async function resetFeatures(): Promise<void> {
  state = { features: { ...FEATURE_DEFAULTS }, loading: false, loaded: false, fetchedAt: 0, source: 'defaults' };
  emit();
  await AsyncStorage.removeItem(CACHE_KEY).catch(() => {});
}

// Refetch when the app returns to the foreground (near-instant pickup of toggles).
AppState.addEventListener('change', (s) => {
  if (s === 'active') fetchFeatures({ force: true });
});
