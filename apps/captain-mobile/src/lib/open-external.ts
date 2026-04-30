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
  // eslint-disable-next-line no-console
  console.info("[captain-whatsapp] rawPhone", { rawPhone: phone });
  const d = normalizePhoneForWhatsApp(phone);
  // eslint-disable-next-line no-console
  console.info("[captain-whatsapp] normalizedPhone", { normalizedPhone: d });
  if (!d) {
    Alert.alert(i18n.t("openExternal.whatsappInvalidTitle"), i18n.t("openExternal.whatsappInvalidBody"));
    return;
  }

  const whatsappUrl = `whatsapp://send?phone=${d}`;
  const waMeUrl = `https://wa.me/${d}`;
  const sanitized = sanitizePhoneForDial(phone);
  /** Prefer original `tel:` shape when dialable; else E.164-style from normalized digits. */
  const telUrl = sanitized ? `tel:${sanitized}` : `tel:+${d}`;

  let whatsappCanOpen = false;
  let waMeCanOpen = false;
  let telCanOpen = false;
  try {
    whatsappCanOpen = await Linking.canOpenURL(whatsappUrl);
  } catch {
    whatsappCanOpen = false;
  }
  // eslint-disable-next-line no-console
  console.info("[captain-whatsapp] whatsappCanOpen", { whatsappCanOpen });

  if (whatsappCanOpen) {
    try {
      await Linking.openURL(whatsappUrl);
      // eslint-disable-next-line no-console
      console.info("[captain-whatsapp] selectedFallback", { selectedFallback: "whatsapp" });
      return;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[captain-whatsapp] whatsapp-open-failed", { error });
    }
  }

  try {
    waMeCanOpen = await Linking.canOpenURL(waMeUrl);
  } catch {
    waMeCanOpen = false;
  }
  // eslint-disable-next-line no-console
  console.info("[captain-whatsapp] waMeCanOpen", { waMeCanOpen });

  if (waMeCanOpen) {
    try {
      await Linking.openURL(waMeUrl);
      // eslint-disable-next-line no-console
      console.info("[captain-whatsapp] selectedFallback", { selectedFallback: "wa.me" });
      return;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[captain-whatsapp] waMe-open-failed", { error });
    }
  }

  try {
    telCanOpen = await Linking.canOpenURL(telUrl);
  } catch {
    telCanOpen = false;
  }
  // eslint-disable-next-line no-console
  console.info("[captain-whatsapp] telCanOpen", { telCanOpen });

  if (telCanOpen) {
    try {
      await Linking.openURL(telUrl);
      // eslint-disable-next-line no-console
      console.info("[captain-whatsapp] selectedFallback", { selectedFallback: "tel" });
      return;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[captain-whatsapp] tel-open-failed", { error });
    }
  }

  // eslint-disable-next-line no-console
  console.info("[captain-whatsapp] selectedFallback", { selectedFallback: "none" });
  Alert.alert(
    i18n.t("openExternal.whatsappOrDialUnavailableTitle"),
    i18n.t("openExternal.whatsappOrDialUnavailableBody"),
  );
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
