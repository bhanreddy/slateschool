import type { VaultAccount } from '../services/accountVault';
import { isStudentRole } from './roleHelpers';

/** Home route after switching to a vaulted login (separate credentials per portal). */
export function getHomeRouteForRole(roleCode: string | null | undefined): string {
  switch (roleCode) {
    case 'admin':
    case 'principal':
      return '/admin/dashboard';
    case 'accountant':
    case 'accounts':
      return '/accounts/dashboard';
    case 'staff':
    case 'teacher':
      return '/staff/dashboard';
    case 'driver':
      return '/driver/dashboard';
    case 'parent':
    case 'student':
    default:
      return '/(tabs)/home';
  }
}

/** Human-readable portal label shown in the account switcher. */
export function getPortalLabelForRole(roleCode: string | null | undefined): string {
  switch (roleCode) {
    case 'student':
    case 'parent':
      return 'Parent';
    case 'staff':
    case 'teacher':
      return 'Staff';
    case 'admin':
    case 'principal':
      return 'Admin';
    case 'accountant':
    case 'accounts':
      return 'Accounts';
    case 'driver':
      return 'Driver';
    default:
      return 'Account';
  }
}

export function getVaultAccountSubtitle(acct: VaultAccount): string {
  const roleCode = acct.validatedUser?.role?.code;
  const portal = getPortalLabelForRole(roleCode);
  if (isStudentRole(roleCode)) {
    const detail = acct.classLabel || acct.admissionNo;
    return detail ? `${portal} · ${detail}` : portal;
  }
  const staffCode = acct.validatedUser?.staff_code;
  if (staffCode && (roleCode === 'staff' || roleCode === 'teacher')) {
    return `${portal} · ${staffCode}`;
  }
  return portal;
}
