/**
 * Human-facing order # for tables (per-company sequence from API).
 * 1–9 → two-digit string (01); 10+ unchanged. If no sequence, show full backend order code (e.g. ORD-…).
 */
export function formatOrderDisplayLabel(displayOrderNo: number | null | undefined, fallbackOrderNumber: string): string {
  const fallback = String(fallbackOrderNumber ?? "").trim();
  if (displayOrderNo == null || !Number.isFinite(Number(displayOrderNo))) {
    return fallback.length > 0 ? fallback : "—";
  }
  const n = Math.floor(Number(displayOrderNo));
  if (n < 1) return fallback.length > 0 ? fallback : "—";
  if (n < 10) return String(n).padStart(2, "0");
  return String(n);
}
