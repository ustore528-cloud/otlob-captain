import type { OrderStatusDto } from "@/services/api/dto";

/**
 * **Single trigger** for all payment / COD UI (financial breakdown + change calculator).
 *
 * Per `docs/captain-order-lifecycle.md`, `IN_TRANSIT` means **قيد التوصيل** — the captain is in the
 * delivery-to-customer leg (en route to or at drop-off). That is when cash-on-delivery collection
 * and change are operationally relevant.
 *
 * **Enforcement:** `OrderFinancialSection` requires `orderStatus` and returns `null` unless this
 * passes — so payment UI never renders in irrelevant states even if a caller forgets an outer guard.
 *
 * Not shown for: offer (`ASSIGNED`), `ACCEPTED`, `PICKED_UP`, `DELIVERED`, or any other status.
 */
export const PAYMENT_UI_ACTIVE_STATUS = "IN_TRANSIT" as const satisfies OrderStatusDto;

function isPaymentUiActiveStatus(status: OrderStatusDto): boolean {
  return status === PAYMENT_UI_ACTIVE_STATUS;
}

/** Financial breakdown card (amounts, fees, total). */
export function shouldShowOrderFinancialSection(status: OrderStatusDto): boolean {
  return isPaymentUiActiveStatus(status);
}

/** Israeli cash change calculator (paid vs customer total). */
export function shouldShowCashChangeCalculator(status: OrderStatusDto): boolean {
  return isPaymentUiActiveStatus(status);
}
