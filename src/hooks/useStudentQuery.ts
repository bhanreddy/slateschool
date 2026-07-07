import { useApiQuery, UseApiQueryOptions } from './useApiQuery';
import { useAuth } from './useAuth';
import { isStudentRole } from '../utils/roleHelpers';

export type UseStudentQueryOptions = UseApiQueryOptions;

/**
 * Student-screen GET cache — only runs for parent/student portal roles.
 * Uses silent API mode so a stale in-flight request after account switch
 * never pops a blocking "Access Denied" dialog on another portal.
 */
export function useStudentQuery<T>(
  endpoint: string,
  cacheKeySuffix: string,
  ttlMs: number,
  userId: string | null | undefined,
  options: UseStudentQueryOptions = {}
) {
  const { role } = useAuth();
  const portalEligible = isStudentRole(role);
  const enabled = (options.enabled ?? true) && portalEligible && !!userId;

  return useApiQuery<T>(endpoint, cacheKeySuffix, ttlMs, userId, {
    ...options,
    enabled,
    silent: options.silent ?? true,
  });
}
