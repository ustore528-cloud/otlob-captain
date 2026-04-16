import type { OrderStatus } from "@/types/api";

export type OrderBadgeVariant = "default" | "success" | "warning" | "danger" | "muted";

const labels: Record<OrderStatus, string> = {
  PENDING: "بانتظار التوزيع",
  CONFIRMED: "تجهيز",
  ASSIGNED: "مُعيَّن",
  ACCEPTED: "مقبول",
  PICKED_UP: "تم الاستلام",
  IN_TRANSIT: "قيد التوصيل",
  DELIVERED: "تم التسليم",
  CANCELLED: "ملغى",
};

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
  return labels[s] ?? s;
}

export function orderStatusBadgeVariant(s: OrderStatus): OrderBadgeVariant {
  return badgeVariant[s] ?? "muted";
}
