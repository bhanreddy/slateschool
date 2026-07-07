import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { AccessContext, PortalContextsPayload } from '../types/context';

const ACTIVE_CONTEXT_KEY = 'portal_active_context_id_v1';
const CONTEXTS_CACHE_KEY = 'portal_contexts_cache_v1';

async function readKey(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return await AsyncStorage.getItem(key);
    }
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function writeKey(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function removeKey(key: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      await AsyncStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  } catch {
    // ignore
  }
}

export async function getActiveContextId(): Promise<string | null> {
  return readKey(ACTIVE_CONTEXT_KEY);
}

export async function setActiveContextId(contextId: string | null): Promise<void> {
  if (!contextId) {
    await removeKey(ACTIVE_CONTEXT_KEY);
    return;
  }
  await writeKey(ACTIVE_CONTEXT_KEY, contextId);
}

export async function getCachedPortalContexts(): Promise<PortalContextsPayload | null> {
  const raw = await readKey(CONTEXTS_CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PortalContextsPayload;
  } catch {
    return null;
  }
}

export async function setCachedPortalContexts(payload: PortalContextsPayload | null): Promise<void> {
  if (!payload) {
    await removeKey(CONTEXTS_CACHE_KEY);
    return;
  }
  await writeKey(CONTEXTS_CACHE_KEY, JSON.stringify(payload));
}

export async function applyPortalSwitchResult(payload: {
  activeContextId: string;
  activeContext: AccessContext;
  groups?: PortalContextsPayload['groups'];
  total?: number;
}): Promise<PortalContextsPayload> {
  await setActiveContextId(payload.activeContextId);
  const cached: PortalContextsPayload = {
    activeContextId: payload.activeContextId,
    activeContext: payload.activeContext,
    groups: payload.groups ?? [],
    total: payload.total ?? 0,
  };
  await setCachedPortalContexts(cached);
  return cached;
}

export async function clearActiveContextStore(): Promise<void> {
  await removeKey(ACTIVE_CONTEXT_KEY);
  await removeKey(CONTEXTS_CACHE_KEY);
}
