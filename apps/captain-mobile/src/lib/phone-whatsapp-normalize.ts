/**
 * WhatsApp `wa.me` path: digits only, no `+`. Palestine **970** and Israel **972** only.
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
 * **Rejected:** Anything else (including ambiguous domestic `05…` without country) — callers show Arabic guidance.
 */
export function normalizePhoneForWhatsApp(phone: string): string | null {
  const pre = preprocess(phone);
  if (!pre) return null;

  let d = pre.startsWith("+") ? pre.slice(1).replace(/\D/g, "") : pre.replace(/\D/g, "");
  if (!d) return null;

  if (d.startsWith("00")) d = d.slice(2);

  const ok = (prefix: "972" | "970") =>
    d.startsWith(prefix) && d.length >= WA_MIN && d.length <= WA_MAX;

  if (ok("972") || ok("970")) {
    return d;
  }

  if (d.length === 10 && d.startsWith("05")) return null;

  return null;
}
