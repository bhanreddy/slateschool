/**
 * useFeatures — read per-school STUDENT feature flags in components.
 *   const { isEnabled, loading, refresh } = useFeatures();
 *   if (!isEnabled('nav.fees')) return null;
 *
 * useFeatureGuard(key) — route guard: redirect deep-links to a disabled feature
 * back to Home with a toast. Hiding the entry point is not enough on its own.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { usePathname, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { subscribe, getSnapshot, fetchFeatures, refresh } from '../services/featuresStore';
import type { FeatureKey } from '../config/featureFlags';
import { useAuth } from './useAuth';
import { isStudentRole } from '../utils/roleHelpers';

export function useFeatures() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // Always force on mount — stale AsyncStorage cache must not block admin toggles.
  useEffect(() => {
    fetchFeatures({ force: true });
  }, []);

  return {
    features: state.features,
    // Skeleton only before we have ANY value; once cache/defaults land, render.
    loading: state.loading && !state.loaded,
    // Absent/unknown key => enabled, matching backend absent=default semantics.
    isEnabled: (key: FeatureKey | string) => state.features[key] !== false,
    refresh,
  };
}

/** Redirect to Home with a toast if `key` is disabled. Use at the top of gated screens. */
export function useFeatureGuard(key: FeatureKey | string) {
  const { isEnabled, loading } = useFeatures();
  const router = useRouter();
  const enabled = isEnabled(key);

  useEffect(() => {
    if (loading) return; // wait until we know
    if (!enabled) {
      Toast.show({
        type: 'error',
        text1: 'Unavailable',
        text2: 'This feature is turned off for your school.',
      });
      router.replace('/(tabs)/home');
    }
  }, [enabled, loading, key, router]);

  return enabled;
}

/**
 * Layout-level guard: redirect student/parent users away from a route when its
 * feature flag is off. Staff/admin routes are unaffected.
 */
export function useRouteFeatureGuard(
  routeMap: Record<string, FeatureKey>,
  opts?: { prefix?: string },
) {
  const pathname = usePathname();
  const router = useRouter();
  const { role } = useAuth();
  const { isEnabled, loading } = useFeatures();

  const key = (() => {
    if (routeMap[pathname]) return routeMap[pathname];
    if (opts?.prefix && pathname.startsWith(opts.prefix)) {
      return routeMap[opts.prefix];
    }
    return null;
  })();

  const shouldGuard = !!key && isStudentRole(role);
  const enabled = !shouldGuard || isEnabled(key!);

  useEffect(() => {
    if (!shouldGuard || loading) return;
    if (!enabled) {
      Toast.show({
        type: 'error',
        text1: 'Unavailable',
        text2: 'This feature is turned off for your school.',
      });
      router.replace('/(tabs)/home');
    }
  }, [shouldGuard, enabled, loading, router]);

  return enabled;
}
