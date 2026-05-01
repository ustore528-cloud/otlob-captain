import type { TFunction } from "i18next";
import { Alert } from "react-native";

export type GuestLoginRequiredAlertArgs = {
  t: TFunction;
  /** Primary — sign in with a real captain account. */
  onSignIn: () => void;
  /** Secondary — dismiss and remain in guest preview. */
  onStayGuest: () => void;
};

/**
 * Reusable UX when a guest hits a captain-only capability.
 * Uses `guestMode.loginRequiredTitle` / `guestMode.loginRequiredBody` plus action labels.
 */
export function showGuestLoginRequiredAlert({
  t,
  onSignIn,
  onStayGuest,
}: GuestLoginRequiredAlertArgs): void {
  Alert.alert(String(t("guestMode.loginRequiredTitle")), String(t("guestMode.loginRequiredBody")), [
    { text: String(t("guestMode.stayAsGuest")), style: "cancel", onPress: onStayGuest },
    { text: String(t("guestMode.signInAction")), style: "default", onPress: onSignIn },
  ]);
}
