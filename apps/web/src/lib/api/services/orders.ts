import { apiFetch, paths } from "@/lib/api/http";
import type { OrderDetail, OrderListItem, OrderStatus, Paginated } from "@/types/api";

export type CreateOrderPayload = {
  storeId?: string;
  /**
   * SUPER_ADMIN: مطلوب عندما لا يُرسل `storeId` — يُنشأ/يُحمَّل متجر تشغيلي ضمن هذه الشركة.
   * شركة أخرى: يُرفض إن لم يطابق شركة المستخدم في الخادم.
   */
  companyId?: string;
  /** اختياري مع `companyId` — يقيِّد المتجر التشغيلي والفرع. */
  branchId?: string;
  /** ربط بحساب عميل — اختياري؛ وإلا يُستنتج من الهاتف في الخادم */
  customerUserId?: string;
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  dropoffAddress: string;
  area: string;
  /** مبلغ متجر/طلب (بدون رسوم التوصيل) — واجهة Company Admin ترسل مبلغ الطلب بلا `storeId` */
  amount: number;
  /** رسوم التوصيل (يسمح بصفر). يُحسب على الخادم: cash_collection = amount + delivery_fee */
  deliveryFee?: number;
  /** إجمالي التحصيل من العميل؛ اختياري — الخادم يحسبه من amount + delivery_fee */
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

export function getOrderById(token: string, id: string): Promise<OrderDetail> {
  return apiFetch<OrderDetail>(paths.orders.byId(id), { token });
}

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

export function distributionAutoAssignVisible(
  token: string,
  body: { orderIds: string[]; zoneId?: string },
): Promise<{ success: true; assignedCount: number; skippedCount: number; skipped: Array<{ orderId: string; reason: string }> }> {
  return apiFetch(paths.orders.distributionAutoAssignVisible, {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
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

export function distributionReassign(token: string, orderId: string, captainId: string) {
  return apiFetch<unknown>(paths.orders.reassign(orderId), {
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

export function archiveOrder(token: string, orderId: string): Promise<unknown> {
  return apiFetch<unknown>(paths.orders.archive(orderId), { method: "POST", token });
}

export function unarchiveOrder(token: string, orderId: string): Promise<unknown> {
  return apiFetch<unknown>(paths.orders.unarchive(orderId), { method: "POST", token });
}

/** مسار إشرافي — الحالات المسموحة محددة في الخادم */
export function adminOverrideOrderStatus(
  token: string,
  orderId: string,
  status: Extract<OrderStatus, "PENDING" | "CONFIRMED" | "CANCELLED" | "DELIVERED">,
): Promise<unknown> {
  return apiFetch<unknown>(paths.orders.adminOverrideStatus(orderId), {
    method: "POST",
    token,
    body: JSON.stringify({ status }),
  });
}
