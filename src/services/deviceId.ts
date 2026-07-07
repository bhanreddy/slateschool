import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const DEVICE_ID_KEY = 'portal_switcher_device_id_v1';

async function readStoredDeviceId(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return await AsyncStorage.getItem(DEVICE_ID_KEY);
    }
    return await SecureStore.getItemAsync(DEVICE_ID_KEY);
  } catch {
    return null;
  }
}

async function writeStoredDeviceId(value: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(DEVICE_ID_KEY, value);
    return;
  }
  await SecureStore.setItemAsync(DEVICE_ID_KEY, value);
}

/**
 * Stable per-install device identifier for server-side active context binding.
 */
export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await readStoredDeviceId();
  if (existing) return existing;

  const id = Crypto.randomUUID();
  await writeStoredDeviceId(id);
  return id;
}

export async function getDeviceId(): Promise<string | null> {
  return readStoredDeviceId();
}
