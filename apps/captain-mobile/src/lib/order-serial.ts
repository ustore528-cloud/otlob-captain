import { formatOrderDisplayLabel } from "@captain/shared";

/**
 * UI-only serial presentation. Uses per-company `displayOrderNo` when present; otherwise full `orderNumber` (e.g. ORD-…).
 */
export function formatOrderSerial(
  orderNumber: string | null | undefined,
  displayOrderNo?: number | null,
): string {
  return formatOrderDisplayLabel(displayOrderNo ?? null, String(orderNumber ?? "").trim());
}
