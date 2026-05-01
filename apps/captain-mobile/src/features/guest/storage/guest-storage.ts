import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const GUEST_KEY = "captain_guest_mode" as const;

export async function loadGuestFlag(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const v = await SecureStore.getItemAsync(GUEST_KEY);
  return v === "1";
}

export async function persistGuestFlag(): Promise<void> {
  if (Platform.OS === "web") return;
  await SecureStore.setItemAsync(GUEST_KEY, "1");
}

export async function clearGuestStorage(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await SecureStore.deleteItemAsync(GUEST_KEY);
  } catch {
    // ignore if missing
  }
}
