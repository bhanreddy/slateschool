import { useMemo, useCallback } from 'react';
import { useAuth } from './useAuth';

/**
 * Client-side permission helpers (cosmetic UX only — server enforces all gates).
 */
export function usePermissions() {
  const { user, role } = useAuth();

  const permissions = useMemo(
    () => (user?.permissions ?? []).filter(Boolean),
    [user?.permissions],
  );

  const roles = useMemo(
    () => (user?.roles ?? (role ? [role] : [])).filter(Boolean),
    [user?.roles, role],
  );

  const hasPermission = useCallback(
    (code: string) => {
      if (role === 'admin' || roles.includes('admin')) return true;
      return permissions.includes(code);
    },
    [permissions, role, roles],
  );

  const hasAnyPermission = useCallback(
    (codes: string[]) => codes.some((code) => hasPermission(code)),
    [hasPermission],
  );

  return { permissions, roles, hasPermission, hasAnyPermission };
}
