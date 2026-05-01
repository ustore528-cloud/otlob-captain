import { Alert } from "react-native";
import i18n from "@/i18n/i18n";
import { getForegroundPermissionState, requestForegroundPermission } from "./permission";

/**
 * قبل الخروج من حالة OFFLINE على الخادم: يجب السماح بموقع المقدّمة.
 * يعرض رسالة مترجمة عند الرفض ويعيد false.
 */
export async function ensureLocationPermissionForGoingOnline(): Promise<boolean> {
  let p = await getForegroundPermissionState();
  if (p !== "granted") {
    p = await requestForegroundPermission();
  }
  if (p === "granted") return true;

  Alert.alert(
    i18n.t("captain.location.permissionRequiredTitle"),
    i18n.t("captain.location.permissionRequiredBody"),
  );
  return false;
}
