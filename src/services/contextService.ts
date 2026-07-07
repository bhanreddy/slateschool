import { api } from './apiClient';
import { getOrCreateDeviceId } from './deviceId';
import {
  applyPortalSwitchResult,
  setCachedPortalContexts,
} from './activeContextStore';
import type {
  AccessContext,
  PortalContextsPayload,
  RegisterDeviceResponse,
} from '../types/context';

export interface SwitchPortalContextResponse {
  sessionId: string;
  activeContextId: string;
  activeContext: AccessContext;
  homeRoute: string;
  switchedAt: string;
  groups: PortalContextsPayload['groups'];
  total: number;
}

/**
 * Fetch switchable portal/profile contexts for the logged-in user.
 */
export async function fetchPortalContexts(): Promise<PortalContextsPayload> {
  const deviceId = await getOrCreateDeviceId();
  const payload = await api.get<PortalContextsPayload>('/auth/contexts', { device_id: deviceId }, { sendActiveContext: true });
  await setCachedPortalContexts(payload);
  return payload;
}

/**
 * Register this device with the backend and receive the default active context.
 */
export async function registerPortalDevice(): Promise<RegisterDeviceResponse> {
  const deviceId = await getOrCreateDeviceId();
  const payload = await api.post<RegisterDeviceResponse>('/auth/contexts/register-device', { device_id: deviceId }, { sendActiveContext: true });
  if (payload.activeContextId) {
    await applyPortalSwitchResult({
      activeContextId: payload.activeContextId,
      activeContext: payload.activeContext!,
      groups: payload.groups,
      total: payload.total,
    });
  }
  return payload;
}

/**
 * Switch active portal/profile context (server-validated).
 */
export async function switchPortalContext(contextId: string): Promise<PortalContextsPayload> {
  const deviceId = await getOrCreateDeviceId();
  const result = await api.post<SwitchPortalContextResponse>('/auth/contexts/switch', {
    device_id: deviceId,
    context_id: contextId,
  }, { sendActiveContext: true });

  return applyPortalSwitchResult({
    activeContextId: result.activeContextId,
    activeContext: result.activeContext,
    groups: result.groups,
    total: result.total,
  });
}
