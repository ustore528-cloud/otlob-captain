/**
 * Sender/pickup prefill profile for `/request/:ownerCode` (device-only).
 * Primary key shape: `public_request_sender_profile_<ownerCode>`
 */

export type PublicRequestSenderProfile = {
  fullName: string;
  phone: string;
  pickupAddress?: string;
  pickupLatitude?: string;
  pickupLongitude?: string;
};

const LEGACY_STORAGE_PREFIX = "captain_public_sender_v1";

export function publicRequestSenderProfileKey(ownerCode: string): string {
  return `public_request_sender_profile_${ownerCode.trim()}`;
}

function parseProfilePayload(raw: string): PublicRequestSenderProfile | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const o = parsed as Record<string, unknown>;
    const fullName = typeof o.fullName === "string" ? o.fullName : "";
    const phone = typeof o.phone === "string" ? o.phone : "";
    if (!fullName.trim() && !phone.trim()) return null;
    const pickupAddress = typeof o.pickupAddress === "string" ? o.pickupAddress : undefined;
    const pickupLatitude = typeof o.pickupLatitude === "string" ? o.pickupLatitude : undefined;
    const pickupLongitude = typeof o.pickupLongitude === "string" ? o.pickupLongitude : undefined;
    return {
      fullName: fullName.trim(),
      phone: phone.trim(),
      ...(pickupAddress?.trim() ? { pickupAddress: pickupAddress.trim() } : {}),
      ...(pickupLatitude?.trim() ? { pickupLatitude: pickupLatitude.trim() } : {}),
      ...(pickupLongitude?.trim() ? { pickupLongitude: pickupLongitude.trim() } : {}),
    };
  } catch {
    return null;
  }
}

/** Reads saved profile (new key, with one-time migrate from legacy key). */
export function loadPublicRequestSenderProfile(ownerCode: string): PublicRequestSenderProfile | null {
  if (typeof window === "undefined" || !ownerCode.trim()) return null;
  try {
    const code = ownerCode.trim();
    const primaryRaw = window.localStorage.getItem(publicRequestSenderProfileKey(code));
    const primary = primaryRaw !== null ? parseProfilePayload(primaryRaw) : null;
    if (primary) return primary;

    const legacyKey = `${LEGACY_STORAGE_PREFIX}:${code.toLowerCase()}`;
    const legacyRaw = window.localStorage.getItem(legacyKey);
    window.localStorage.removeItem(legacyKey);
    const legacy = legacyRaw !== null ? parseProfilePayload(legacyRaw) : null;
    if (legacy) {
      if (legacy.fullName && legacy.phone) {
        savePublicRequestSenderProfile(code, legacy);
      }
      return legacy;
    }
    return null;
  } catch {
    return null;
  }
}

export function savePublicRequestSenderProfile(ownerCode: string, data: PublicRequestSenderProfile): void {
  if (typeof window === "undefined" || !ownerCode.trim()) return;
  const fullName = data.fullName.trim();
  const phone = data.phone.trim();
  if (!fullName || !phone) return;
  try {
    const payload: PublicRequestSenderProfile = {
      fullName,
      phone,
      ...(data.pickupAddress?.trim() ? { pickupAddress: data.pickupAddress.trim() } : {}),
      ...(data.pickupLatitude?.trim() ? { pickupLatitude: data.pickupLatitude.trim() } : {}),
      ...(data.pickupLongitude?.trim() ? { pickupLongitude: data.pickupLongitude.trim() } : {}),
    };
    window.localStorage.setItem(publicRequestSenderProfileKey(ownerCode.trim()), JSON.stringify({ ...payload, v: 2 }));
  } catch {
    /* quota / private mode */
  }
}

export function removePublicRequestSenderProfile(ownerCode: string): void {
  if (typeof window === "undefined" || !ownerCode.trim()) return;
  try {
    const code = ownerCode.trim();
    window.localStorage.removeItem(publicRequestSenderProfileKey(code));
    window.localStorage.removeItem(`${LEGACY_STORAGE_PREFIX}:${code.toLowerCase()}`);
  } catch {
    /* ignore */
  }
}
