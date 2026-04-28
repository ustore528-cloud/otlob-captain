import { apiFetch, paths } from "@/lib/api/http";
import type {
  CaptainListItem,
  CaptainPrepaidSummary,
  CaptainPrepaidTransaction,
  CaptainStats,
  OrderListItem,
  Paginated,
} from "@/types/api";

export type CreateCaptainPayload = {
  fullName: string;
  phone: string;
  email?: string;
  password: string;
  vehicleType: string;
  area: string;
  /** SUPER_ADMIN — target company (required for that role). */
  companyId?: string;
  /** Required when the tenant has multiple active branches and the actor is not a region-scoped manager. */
  branchId?: string;
  zoneId?: string;
};

export type CaptainsListQuery = {
  page?: number;
  pageSize?: number;
  area?: string;
  isActive?: boolean;
  availabilityStatus?: string;
};

export function getCaptain(token: string, id: string): Promise<CaptainListItem> {
  return apiFetch<CaptainListItem>(paths.captains.byId(id), { token });
}

export function listCaptains(token: string, q: CaptainsListQuery = {}): Promise<Paginated<CaptainListItem>> {
  const p = new URLSearchParams();
  p.set("page", String(q.page ?? 1));
  p.set("pageSize", String(q.pageSize ?? 50));
  if (q.area) p.set("area", q.area);
  if (q.isActive !== undefined) p.set("isActive", String(q.isActive));
  if (q.availabilityStatus) p.set("availabilityStatus", q.availabilityStatus);
  return apiFetch<Paginated<CaptainListItem>>(`${paths.captains.root}?${p.toString()}`, { token });
}

export function createCaptain(token: string, body: CreateCaptainPayload): Promise<CaptainListItem> {
  return apiFetch<CaptainListItem>(paths.captains.root, { method: "POST", token, body: JSON.stringify(body) });
}

export function setCaptainActive(token: string, id: string, isActive: boolean) {
  return apiFetch<CaptainListItem>(paths.captains.active(id), {
    method: "PATCH",
    token,
    body: JSON.stringify({ isActive }),
  });
}

export function getCaptainStats(token: string, id: string): Promise<CaptainStats> {
  return apiFetch<CaptainStats>(paths.captains.stats(id), { token });
}

export type CaptainOrdersQuery = {
  page?: number;
  pageSize?: number;
  from?: string;
  to?: string;
  q?: string;
  area?: string;
  status?: string;
  currentOnly?: boolean;
};

export function listCaptainOrders(token: string, captainId: string, q: CaptainOrdersQuery = {}) {
  const p = new URLSearchParams();
  p.set("page", String(q.page ?? 1));
  p.set("pageSize", String(q.pageSize ?? 20));
  if (q.from) p.set("from", q.from);
  if (q.to) p.set("to", q.to);
  if (q.q) p.set("q", q.q);
  if (q.area) p.set("area", q.area);
  if (q.status) p.set("status", q.status);
  if (q.currentOnly !== undefined) p.set("currentOnly", String(q.currentOnly));
  return apiFetch<Paginated<OrderListItem>>(`${paths.captains.orders(captainId)}?${p.toString()}`, { token });
}

export type UpdateCaptainPayload = {
  vehicleType?: string;
  area?: string;
  isActive?: boolean;
  prepaidEnabled?: boolean;
  commissionPercent?: number | null;
  minimumBalanceToReceiveOrders?: number | null;
  fullName?: string;
  phone?: string;
  supervisorUserId?: string | null;
};

export function updateCaptain(token: string, id: string, body: UpdateCaptainPayload) {
  return apiFetch<CaptainListItem>(paths.captains.byId(id), {
    method: "PATCH",
    token,
    body: JSON.stringify(body),
  });
}

export function deleteCaptain(token: string, id: string) {
  return apiFetch<{ deleted: true }>(paths.captains.byId(id), { method: "DELETE", token });
}

export function getCaptainPrepaidSummary(token: string, id: string): Promise<CaptainPrepaidSummary> {
  return apiFetch<CaptainPrepaidSummary>(paths.captains.prepaidSummary(id), { token });
}

export function listCaptainPrepaidTransactions(
  token: string,
  id: string,
  q: { page?: number; pageSize?: number; from?: string; to?: string } = {},
): Promise<Paginated<CaptainPrepaidTransaction>> {
  const p = new URLSearchParams();
  p.set("page", String(q.page ?? 1));
  p.set("pageSize", String(q.pageSize ?? 20));
  if (q.from) p.set("from", q.from);
  if (q.to) p.set("to", q.to);
  return apiFetch<Paginated<CaptainPrepaidTransaction>>(`${paths.captains.prepaidTransactions(id)}?${p.toString()}`, {
    token,
  });
}

export function chargeCaptainPrepaidBalance(token: string, id: string, body: { amount: number; note?: string }) {
  return apiFetch<CaptainPrepaidTransaction>(paths.captains.prepaidCharge(id), {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export function adjustCaptainPrepaidBalance(token: string, id: string, body: { amount: number; note: string }) {
  return apiFetch<CaptainPrepaidTransaction>(paths.captains.prepaidAdjustment(id), {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}
