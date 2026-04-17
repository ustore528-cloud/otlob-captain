import { apiFetch, paths } from "@/lib/api/http";
import type { OrderListItem, Paginated } from "@/types/api";

export type CreateOrderPayload = {
  storeId?: string;
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  dropoffAddress: string;
  area: string;
  amount: number;
  cashCollection?: number;
  dropoffLatitude?: number;
  dropoffLongitude?: number;
  notes?: string;
  distributionMode?: "AUTO" | "MANUAL";
};

export type OrdersListQuery = {
  page?: number;
  pageSize?: number;
  status?: string;
  area?: string;
  orderNumber?: string;
  customerPhone?: string;
  storeId?: string;
};

export function listOrders(token: string, q: OrdersListQuery): Promise<Paginated<OrderListItem>> {
  const p = new URLSearchParams();
  p.set("page", String(q.page ?? 1));
  p.set("pageSize", String(q.pageSize ?? 20));
  if (q.status) p.set("status", q.status);
  if (q.area) p.set("area", q.area);
  if (q.orderNumber) p.set("orderNumber", q.orderNumber);
  if (q.customerPhone) p.set("customerPhone", q.customerPhone);
  if (q.storeId) p.set("storeId", q.storeId);
  return apiFetch<Paginated<OrderListItem>>(`${paths.orders.root}?${p.toString()}`, { token });
}

export function createOrder(token: string, body: CreateOrderPayload): Promise<OrderListItem> {
  return apiFetch<OrderListItem>(paths.orders.root, { method: "POST", token, body: JSON.stringify(body) });
}

export function distributionAuto(token: string, orderId: string) {
  return apiFetch<unknown>(paths.orders.distributionAuto(orderId), { method: "POST", token });
}

export function distributionResend(token: string, orderId: string) {
  return apiFetch<unknown>(paths.orders.distributionResend(orderId), { method: "POST", token });
}

export function distributionManual(token: string, orderId: string, captainId: string) {
  return apiFetch<unknown>(paths.orders.distributionManual(orderId), {
    method: "POST",
    token,
    body: JSON.stringify({ captainId }),
  });
}

export function distributionDragDrop(token: string, orderId: string, captainId: string) {
  return apiFetch<unknown>(paths.orders.distributionDragDrop(orderId), {
    method: "POST",
    token,
    body: JSON.stringify({ captainId }),
  });
}

export function distributionCancelCaptain(token: string, orderId: string) {
  return apiFetch<unknown>(paths.orders.distributionCancelCaptain(orderId), {
    method: "POST",
    token,
  });
}
