import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth, getAuthSessionSnapshot } from './useAuth';
import { getHomeRouteForRole } from '../utils/portalRoutes';

/**
 * useRequireRole
 *
 * A stricter version of useRoleGuard.
 * Instead of redirecting to the user's default dashboard,
 * it redirects them to an explicit "unauthorized" error screen
 * if they try to access a section they don't have permission for.
 */
export function useRequireRole(...allowedRoles: string[]) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const allowedKey = allowedRoles.join(',');

  useEffect(() => {
    if (loading) return;

    const snapshotUser = getAuthSessionSnapshot()?.validatedUser;
    const effectiveUser = snapshotUser ?? user;

    if (!effectiveUser) {
      router.replace('/welcome');
      return;
    }

    // Handle user.role being either a string or an object { code: string, name: string }
    const roleCode =
      typeof effectiveUser.role === 'object' && effectiveUser.role !== null
        ? (effectiveUser.role as any).code
        : effectiveUser.role;

    if (!allowedRoles.includes(roleCode)) {
      // Send the user to their own portal home (matches useAuthGuard). Avoids
      // a brief "Access Denied" flash when account switching navigates before
      // React state catches up, and is friendlier than /unauthorized for
      // cross-portal deep links.
      router.replace(getHomeRouteForRole(roleCode) as any);
    }
  }, [user, loading, router, allowedKey]);
}
