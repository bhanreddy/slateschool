/**
 * Access context types for the unified portal/profile switcher.
 */

export type PortalType =
  | 'student'
  | 'staff'
  | 'admin'
  | 'accounts'
  | 'driver'
  | 'library'
  | 'transport';

export interface AccessContext {
  id: string;
  portal_type: PortalType;
  role_codes: string[];
  school_id: number;
  school_name: string | null;
  student_id: string | null;
  staff_id: string | null;
  parent_id: string | null;
  display_name: string;
  subtitle: string | null;
  photo_url: string | null;
  source: string;
  home_route: string;
  permissions?: string[];
  is_active?: boolean;
}

export interface AccessContextGroup {
  label: string;
  portal_type: PortalType;
  contexts: AccessContext[];
}

export interface PortalContextsPayload {
  activeContextId: string | null;
  activeContext: AccessContext | null;
  groups: AccessContextGroup[];
  total: number;
}

export interface RegisterDeviceResponse extends PortalContextsPayload {
  deviceId: string;
  sessionId: string;
}
