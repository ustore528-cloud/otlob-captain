import * as Location from "expo-location";
import type { ForegroundPermissionState } from "./types";

export async function getForegroundPermissionState(): Promise<ForegroundPermissionState> {
  const { status } = await Location.getForegroundPermissionsAsync();
  if (status === "granted") return "granted";
  if (status === "denied") return "denied";
  return "unknown";
}

/**
 * يطلب صلاحية الموقع أثناء الاستخدام (واجهة النظام).
 */
export async function requestForegroundPermission(): Promise<ForegroundPermissionState> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status === "granted") return "granted";
  if (status === "denied") return "denied";
  return "unknown";
}
