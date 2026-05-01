/**
 * Lenient validation for mobiles/lines typed in Arab markets (e.g. 05xxxxxxxx, +972xxxxxxxx).
 */

const SEP_RE = /[\s\-\(\)\u200e\u200f\u00a0]/g;

/** True if trimmed input uses only digits, optional leading '+', and common separators/spaces (no letters). */
export function isFlexiblePhoneCharactersOnly(raw: string): boolean {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return false;
  const core = trimmed.replace(SEP_RE, "");
  return /^\+?[0-9]+$/.test(core);
}

/** Digit-only body for length checks (+ and separators removed). */
export function extractFlexiblePhoneDigits(raw: string): string {
  const core = String(raw ?? "").trim().replace(SEP_RE, "").replace(/^\+/, "");
  return core.replace(/\D/g, "");
}

/**
 * Typical mobile/local lines: keep 9–15 digits (covers IL 05xxxxxxxx, +972..., +966..., etc.).
 */
export function isReasonableFlexiblePhone(raw: string): boolean {
  if (!isFlexiblePhoneCharactersOnly(raw)) return false;
  const digits = extractFlexiblePhoneDigits(raw);
  return digits.length >= 9 && digits.length <= 15;
}
