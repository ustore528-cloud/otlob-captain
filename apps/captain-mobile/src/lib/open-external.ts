import { Alert, Linking } from "react-native";

/** Digits and leading + for tel: — strips spaces and dashes */
export function sanitizePhoneForDial(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

export async function openPhoneDialer(phone: string): Promise<void> {
  const n = sanitizePhoneForDial(phone);
  if (!n) {
    Alert.alert("لا يوجد رقم", "رقم الجوال غير صالح للاتصال.");
    return;
  }
  const url = `tel:${n}`;
  try {
    const can = await Linking.canOpenURL(url);
    if (!can) {
      Alert.alert("تعذّر الاتصال", "لا يمكن فتح تطبيق الهاتف على هذا الجهاز.");
      return;
    }
    await Linking.openURL(url);
  } catch {
    Alert.alert("تعذّر الاتصال", "حاول مرة أخرى.");
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
    Alert.alert("تعذّر فتح الخريطة", "حاول مرة أخرى.");
  }
}

/** When lat/lng exist (future API), open precise pin. */
export async function openMapCoordinates(lat: number, lng: number): Promise<void> {
  const url = `https://www.google.com/maps?q=${lat},${lng}`;
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert("تعذّر فتح الخريطة", "حاول مرة أخرى.");
  }
}
