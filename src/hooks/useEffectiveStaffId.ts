import { useLocalSearchParams } from 'expo-router';

/**
 * When an admin opens a staff member's portal from Manage Staff, the target
 * staffId/viewAsName travel as route params. Real staff members navigating
 * their own portal never carry these params, so `isViewingAsAdmin` is false
 * and every screen keeps using its normal session-derived ("my …") calls.
 */
export function useEffectiveStaffId() {
  const { staffId, viewAsName } = useLocalSearchParams<{ staffId?: string; viewAsName?: string }>();
  const isViewingAsAdmin = typeof staffId === 'string' && staffId.length > 0;

  return {
    staffId: isViewingAsAdmin ? staffId : undefined,
    isViewingAsAdmin,
    viewAsName: isViewingAsAdmin ? viewAsName : undefined,
  };
}
