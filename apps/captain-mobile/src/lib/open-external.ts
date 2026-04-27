import { Alert, Linking } from "react-native";
import i18n from "@/i18n/i18n";
import { normalizePhoneForWhatsApp } from "@/lib/phone-whatsapp-normalize";

export { normalizePhoneForWhatsApp };

/** Digits and leading + for tel: — strips spaces and dashes */
export function sanitizePhoneForDial(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

export async function openPhoneDialer(phone: string): Promise<void> {
  const n = sanitizePhoneForDial(phone);
  if (!n) {
    Alert.alert(i18n.t("openExternal.phoneNoNumberTitle"), i18n.t("openExternal.phoneNoNumberBody"));
    return;
  }
  const url = `tel:${n}`;
  try {
    const can = await Linking.canOpenURL(url);
    if (!can) {
      Alert.alert(i18n.t("openExternal.phoneCannotOpenTitle"), i18n.t("openExternal.phoneCannotOpenBody"));
      return;
    }
    await Linking.openURL(url);
  } catch {
    Alert.alert(i18n.t("openExternal.phoneFailedTitle"), i18n.t("openExternal.phoneFailedBody"));
  }
}

export async function openWhatsAppChat(phone: string): Promise<void> {
  const d = normalizePhoneForWhatsApp(phone);
  if (!d) {
    Alert.alert(i18n.t("openExternal.whatsappInvalidTitle"), i18n.t("openExternal.whatsappInvalidBody"));
    return;
  }
  const url = `https://wa.me/${d}`;
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(i18n.t("openExternal.whatsappFailedTitle"), i18n.t("openExternal.whatsappFailedBody"));
  }
}

/**
 * Opens maps with a search query (address). Prefer when no coordinates exist.
 * Uses Google Maps HTTPS URL — handled by the system maps app or browser.
 */
export async function openMapSearch(address: string): Promise<void> {
  const q = address.trim();
  if (!q) return;
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(i18n.t("openExternal.mapFailedTitle"), i18n.t("openExternal.mapFailedBody"));
  }
}

/** When lat/lng exist (future API), open precise pin. */
export async function openMapCoordinates(lat: number, lng: number): Promise<void> {
  const url = `https://www.google.com/maps?q=${lat},${lng}`;
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(i18n.t("openExternal.mapFailedTitle"), i18n.t("openExternal.mapFailedBody"));
  }
}
