/**
 * WhatsApp `wa.me` path: digits only, no `+`.
 * Supports:
 * - International numbers (970 / 972), including optional trunk zero after country code
 *   - e.g. 972054... -> 97254...
 * - Local Israel mobile format 05xxxxxxxx -> 9725xxxxxxxx
 *
 * Strips spaces, dashes, parentheses, dots, brackets, slashes, and other non-digit noise
 * (except an optional leading `+` before digit extraction).
 */

const WA_MIN = 11;
const WA_MAX = 15;

/** Visible and common invisible separators; keep `+` for international prefix. */
const PHONE_NOISE = /[\s\u200e\u200f\u202a\u202c\-().\[\]/\\|_~]/g;

function preprocess(raw: string): string {
  let s = raw.trim().replace(PHONE_NOISE, "");
  s = s.replace(/\./g, "");
  return s;
}

/**
 * **Accepted:** After cleanup: **972** or **970** international (11–15 digits), optional `+` / `00`;
 * or Israeli local **05xxxxxxxx** (mapped to **9725xxxxxxxx**).
 *
 * **Rejected:** Anything else — callers show i18n guidance.
 */
export function normalizePhoneForWhatsApp(phone: string): string | null {
  const pre = preprocess(phone);
  if (!pre) return null;

  let d = pre.startsWith("+") ? pre.slice(1).replace(/\D/g, "") : pre.replace(/\D/g, "");
  if (!d) return null;

  if (d.startsWith("00")) d = d.slice(2);

  // Handle numbers that include a trunk zero after country code.
  // Example: 9720541234567 -> 972541234567
  if (d.startsWith("9720")) d = `972${d.slice(4)}`;
  if (d.startsWith("9700")) d = `970${d.slice(4)}`;

  const ok = (prefix: "972" | "970") =>
    d.startsWith(prefix) && d.length >= WA_MIN && d.length <= WA_MAX;

  if (ok("972") || ok("970")) {
    return d;
  }

  if (d.length === 10 && d.startsWith("05")) return `972${d.slice(1)}`;

  return null;
}
