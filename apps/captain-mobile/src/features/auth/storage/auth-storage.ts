import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type { SessionSnapshot } from "../types";

const KEYS = {
  access: "captain_access_token",
  refresh: "captain_refresh_token",
  snapshot: "captain_session_snapshot",
} as const;

export async function loadStoredTokens(): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
}> {
  if (Platform.OS === "web") {
    return { accessToken: null, refreshToken: null };
  }
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(KEYS.access),
    SecureStore.getItemAsync(KEYS.refresh),
  ]);
  return { accessToken, refreshToken };
}

export async function loadSnapshot(): Promise<SessionSnapshot | null> {
  if (Platform.OS === "web") {
    return null;
  }
  const raw = await SecureStore.getItemAsync(KEYS.snapshot);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionSnapshot;
  } catch {
    return null;
  }
}

export async function persistTokens(accessToken: string, refreshToken: string): Promise<void> {
  if (Platform.OS === "web") {
    return;
  }
  await SecureStore.setItemAsync(KEYS.access, accessToken);
  await SecureStore.setItemAsync(KEYS.refresh, refreshToken);
}

export async function persistSnapshot(snapshot: SessionSnapshot): Promise<void> {
  if (Platform.OS === "web") {
    return;
  }
  await SecureStore.setItemAsync(KEYS.snapshot, JSON.stringify(snapshot));
}

export async function clearAuthStorage(): Promise<void> {
  if (Platform.OS === "web") {
    return;
  }
  await SecureStore.deleteItemAsync(KEYS.access);
  await SecureStore.deleteItemAsync(KEYS.refresh);
  try {
    await SecureStore.deleteItemAsync(KEYS.snapshot);
  } catch {
    // ignore if missing
  }
}
