/**
 * UI-only serial presentation for order number.
 * Keeps backend identifiers unchanged for actions/navigation.
 */
export function formatOrderSerial(orderNumber: string | null | undefined): string {
  const raw = String(orderNumber ?? "").trim();
  if (!raw) return "00";
  const digits = raw.replace(/\D+/g, "");
  if (!digits) return "00";
  const n = Number.parseInt(digits, 10);
  if (!Number.isFinite(n)) return "00";
  const two = Math.abs(n % 100);
  return String(two).padStart(2, "0");
}
