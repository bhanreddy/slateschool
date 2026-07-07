import { Stack } from 'expo-router';
import React from 'react';
import { ErrorBoundary } from '@/src/components/ErrorBoundary';
import { useRouteFeatureGuard } from '@/src/hooks/useFeatures';
import { SCREEN_FEATURE_MAP } from '@/src/config/screenFeatureMap';

export { ErrorBoundary } from '@/src/components/ErrorBoundary';

/**
 * Groups all `/Screen/*` routes so a single error boundary isolates failures from the root navigator.
 */
export default function ScreenSectionLayout() {
  useRouteFeatureGuard(SCREEN_FEATURE_MAP);

  return (
    <ErrorBoundary>
      <Stack screenOptions={{ contentStyle: { backgroundColor: 'transparent'}, headerShown: false }} />
    </ErrorBoundary>
  );
}
