import { Session } from '@supabase/supabase-js';

export interface ValidatedUser {
  userId: string;
  schoolId: number;
  displayName: string;
  /** Legacy alias for displayName */
  display_name?: string;
  /** First name (if available separately) */
  first_name?: string;
  /** Full name (used in older screens) */
  name?: string;
  photoUrl: string | null;
  role: { code: string; name: string };
  /** All role codes for this user (from JWT → DB). */
  roles?: string[];
  /** Permission codes granted via role_permissions (from JWT → DB). */
  permissions?: string[];
  accountStatus: string;
  /** staff.id when this login is linked to a staff record (payslips, attendance, etc.) */
  staffId?: string | null;
  /** Legacy snake_case alias for staffId */
  staff_id?: string | null;
  /** Staff code */
  staff_code?: string | null;
  has_student_profile?: boolean;
  has_staff_profile?: boolean;
  /** True when admin is logging in with a temporary password that must be changed */
  requiresPasswordChange?: boolean;
  /** Contact email */
  email?: string | null;
  /** Contact phone */
  phone?: string | null;
  /** Gender */
  gender?: string | null;
  /** Student class ID */
  classId?: string | null;
  /** Student roll number */
  rollNo?: string | null;
  /** Direct user ID (sometimes used as alternative to userId) */
  id?: string | null;
  /** Student admission number */
  admission_no?: string | null;
  /** Portal switcher contexts (Phase 0+) */
  portalContexts?: import('./context').PortalContextsPayload | null;
}

export interface AuthSession {
  supabaseSession: Session;     // from Supabase
  validatedUser: ValidatedUser; // from backend validation
  tokenExpiresAt: number;       // Unix timestamp
}
