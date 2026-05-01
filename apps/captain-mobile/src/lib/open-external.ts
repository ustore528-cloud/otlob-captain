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

async function tryOpenUrl(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Opens WhatsApp for a customer number. Tries in order (no `canOpenURL` gating — iOS often
 * reports false for `whatsapp://` unless LSApplicationQueriesSchemes includes `whatsapp`):
 * 1) whatsapp://send?phone=&lt;digits&gt;
 * 2) https://wa.me/&lt;digits&gt;
 * 3) tel:+&lt;digits&gt;
 */
export async function openWhatsAppChat(phone: string | null | undefined): Promise<void> {
  const rawPhone = typeof phone === "string" ? phone : phone == null ? "" : String(phone);
  // eslint-disable-next-line no-console
  console.info("[captain-whatsapp] rawPhone", rawPhone);

  const d = normalizePhoneForWhatsApp(rawPhone);
  // eslint-disable-next-line no-console
  console.info("[captain-whatsapp] normalizedPhone", d ?? "");

  if (!d) {
    // eslint-disable-next-line no-console
    console.info("[captain-whatsapp] openResult", "invalid");
    Alert.alert(i18n.t("captain.external.invalidPhoneTitle"), i18n.t("captain.external.invalidPhoneBody"));
    return;
  }

  const whatsappUrl = `whatsapp://send?phone=${d}`;
  const waMeUrl = `https://wa.me/${d}`;
  const telUrl = `tel:+${d}`;

  // eslint-disable-next-line no-console
  console.info("[captain-whatsapp] whatsappUrl", whatsappUrl);
  // eslint-disable-next-line no-console
  console.info("[captain-whatsapp] waMeUrl", waMeUrl);
  // eslint-disable-next-line no-console
  console.info("[captain-whatsapp] telUrl", telUrl);

  if (await tryOpenUrl(whatsappUrl)) {
    // eslint-disable-next-line no-console
    console.info("[captain-whatsapp] openResult", "whatsapp");
    return;
  }
  // eslint-disable-next-line no-console
  console.info("[captain-whatsapp] error", "whatsapp_scheme");

  if (await tryOpenUrl(waMeUrl)) {
    // eslint-disable-next-line no-console
    console.info("[captain-whatsapp] openResult", "wa.me");
    return;
  }
  // eslint-disable-next-line no-console
  console.info("[captain-whatsapp] error", "wa_me");

  if (await tryOpenUrl(telUrl)) {
    // eslint-disable-next-line no-console
    console.info("[captain-whatsapp] openResult", "tel");
    return;
  }
  // eslint-disable-next-line no-console
  console.info("[captain-whatsapp] error", "tel");
  // eslint-disable-next-line no-console
  console.info("[captain-whatsapp] openResult", "none");

  Alert.alert(
    i18n.t("captain.external.whatsappUnavailableTitle"),
    i18n.t("captain.external.whatsappUnavailableBody"),
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

export function hasMapCoordinates(lat: unknown, lng: unknown): boolean {
  return typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng);
}

/** Prefer a map pin when coordinates exist; otherwise open a search for the address string. */
export async function openOrderMapNav(opts: {
  address: string;
  lat?: number | null;
  lng?: number | null;
}): Promise<void> {
  const { address, lat, lng } = opts;
  if (hasMapCoordinates(lat, lng)) {
    await openMapCoordinates(lat as number, lng as number);
    return;
  }
  await openMapSearch(address);
}
