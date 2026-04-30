/**
 * WhatsApp `wa.me` path: digits only, no `+`.
 * Supports:
 * - International numbers (970 / 972), including optional trunk zero after country code
 *   - e.g. 972054... -> 97254...
 * - Local Israel mobile format 05xxxxxxxx -> 9725xxxxxxxx
 */

const WA_MIN = 11;
const WA_MAX = 15;

function preprocess(raw: string): string {
  let s = raw.trim().replace(/[\s\u200e\u200f\-().]/g, "");
  s = s.replace(/\./g, "");
  return s;
}

/**
 * **Accepted:** Full international strings after cleanup, starting with **972** or **970**,
 * length 11–15 digits (E.164-style), optional leading `+` or `00`.
 *
 * **Rejected:** Anything else — callers show Arabic guidance.
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
