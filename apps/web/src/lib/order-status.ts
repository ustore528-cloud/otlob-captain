import i18n from "@/i18n/i18n";
import type { OrderStatus } from "@/types/api";

export type OrderBadgeVariant = "default" | "success" | "warning" | "danger" | "muted";

const badgeVariant: Record<OrderStatus, OrderBadgeVariant> = {
  PENDING: "default",
  CONFIRMED: "warning",
  ASSIGNED: "default",
  ACCEPTED: "success",
  PICKED_UP: "success",
  IN_TRANSIT: "success",
  DELIVERED: "success",
  CANCELLED: "danger",
};

export function orderStatusLabel(s: OrderStatus): string {
  const key = `orderStatus.${s}`;
  return i18n.exists(key) ? String(i18n.t(key)) : s;
}

export function orderStatusBadgeVariant(s: OrderStatus): OrderBadgeVariant {
  return badgeVariant[s] ?? "muted";
}
