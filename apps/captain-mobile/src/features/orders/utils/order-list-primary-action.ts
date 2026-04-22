import type { OrderDetailDto, OrderListItemDto, OrderStatusDto } from "@/services/api/dto";
import { formatOrderAmountAr, formatOrderAmountEnLine } from "@/lib/order-currency";

export type ListPrimaryKind =
  | "navigate_detail"
  | "pickup"
  | "in_transit"
  | "delivered"
  | "view_only";

export type ListPrimaryAction = {
  kind: ListPrimaryKind;
  /** English label for main button (product spec) */
  labelEn: string;
  /** Short Arabic hint under title */
  labelAr: string;
};

/**
 * One state-driven primary action per list card — keeps backend transition rules.
 */
export function getOrderListPrimaryAction(status: OrderStatusDto): ListPrimaryAction | null {
  switch (status) {
    case "ASSIGNED":
    case "CONFIRMED":
    case "PENDING":
      return {
        kind: "navigate_detail",
        labelEn: "Confirm Order",
        labelAr: "تأكيد الطلب",
      };
    case "ACCEPTED":
      return { kind: "pickup", labelEn: "Picked Up", labelAr: "تم الاستلام" };
    case "PICKED_UP":
      return { kind: "in_transit", labelEn: "On the way", labelAr: "في الطريق للعميل" };
    case "IN_TRANSIT":
      return { kind: "delivered", labelEn: "Delivered", labelAr: "تم التسليم" };
    case "DELIVERED":
    case "CANCELLED":
      return { kind: "view_only", labelEn: "View", labelAr: "عرض" };
    default:
      return null;
  }
}

export function paymentSummaryLine(item: OrderListItemDto): string {
  const cash = parseFloat(item.cashCollection || "0");
  const amt = parseFloat(item.amount || "0");
  if (cash > 0) {
    return formatOrderAmountEnLine("Cash on delivery · collect", item.cashCollection);
  }
  return formatOrderAmountEnLine("Order amount ·", amt.toFixed(2));
}

export function paymentSummaryLineAr(item: OrderListItemDto): string {
  const cash = parseFloat(item.cashCollection || "0");
  if (cash > 0) {
    return `نقد عند التسليم · تحصيل ${formatOrderAmountAr(item.cashCollection)}`;
  }
  return `قيمة الطلب · ${formatOrderAmountAr(item.amount)}`;
}

export function paymentSummaryLineFromDetail(order: OrderDetailDto): string {
  const cash = parseFloat(order.cashCollection || "0");
  const amt = parseFloat(order.amount || "0");
  if (cash > 0) {
    return formatOrderAmountEnLine("Cash on delivery · collect", order.cashCollection);
  }
  return formatOrderAmountEnLine("Order amount ·", amt.toFixed(2));
}

export function paymentSummaryLineArFromDetail(order: OrderDetailDto): string {
  const cash = parseFloat(order.cashCollection || "0");
  if (cash > 0) {
    return `نقد عند التسليم · تحصيل ${formatOrderAmountAr(order.cashCollection)}`;
  }
  return `قيمة الطلب · ${formatOrderAmountAr(order.amount)}`;
}
