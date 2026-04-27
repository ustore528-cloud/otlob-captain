import type { OrderDetailDto, OrderStatusDto } from "@/services/api/dto";
import { resolveOrderFinancialBreakdownDto } from "@/lib/order-financial-breakdown";
import i18n from "@/i18n/i18n";

export type ListPrimaryKind =
  | "navigate_detail"
  | "pickup"
  | "in_transit"
  | "delivered"
  | "view_only";

export type ListPrimaryAction = {
  kind: ListPrimaryKind;
  /** i18n key under `primaryAction.*` */
  labelKey: string;
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
        labelKey: "primaryAction.confirmOrder",
      };
    case "ACCEPTED":
      return { kind: "pickup", labelKey: "primaryAction.pickedUp" };
    case "PICKED_UP":
      return { kind: "in_transit", labelKey: "primaryAction.onTheWay" };
    case "IN_TRANSIT":
      return { kind: "delivered", labelKey: "primaryAction.delivered" };
    case "DELIVERED":
    case "CANCELLED":
      return { kind: "view_only", labelKey: "primaryAction.view" };
    default:
      return null;
  }
}

export function paymentSummaryLineFromDetail(order: OrderDetailDto): string {
  const dto = resolveOrderFinancialBreakdownDto({
    amount: order.amount,
    cashCollection: order.cashCollection,
    deliveryFee: order.deliveryFee ?? null,
    financialBreakdown: order.financialBreakdown,
  });
  return `${i18n.t("money.storeAmount")} ${dto.orderAmount} · ${i18n.t("money.deliveryFee")} ${dto.deliveryFee} · ${i18n.t("money.customerCollection")} ${dto.customerTotal} ₪`;
}

/** Multiline money summary for compact assignment chrome (locale from i18n). */
export function paymentSummaryLinesFromDetail(order: OrderDetailDto): string {
  const dto = resolveOrderFinancialBreakdownDto({
    amount: order.amount,
    cashCollection: order.cashCollection,
    deliveryFee: order.deliveryFee ?? null,
    financialBreakdown: order.financialBreakdown,
  });
  return [
    i18n.t("assignment.moneyLine1", { a: dto.orderAmount }),
    i18n.t("assignment.moneyLine2", { f: dto.deliveryFee }),
    i18n.t("assignment.moneyLine3", { c: dto.customerTotal }),
  ].join("\n");
}
