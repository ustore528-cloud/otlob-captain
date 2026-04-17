import { apiFetch, paths } from "@/lib/api/http";
import type { CaptainListItem, CaptainStats, OrderListItem, Paginated } from "@/types/api";

export type CreateCaptainPayload = {
  fullName: string;
  phone: string;
  email?: string;
  password: string;
  vehicleType: string;
  area: string;
};

export type CaptainsListQuery = {
  page?: number;
  pageSize?: number;
  area?: string;
  isActive?: boolean;
  availabilityStatus?: string;
};

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
  return apiFetch<Paginated<OrderListItem>>(`${paths.captains.orders(captainId)}?${p.toString()}`, { token });
}

export type UpdateCaptainPayload = {
  vehicleType?: string;
  area?: string;
  isActive?: boolean;
  fullName?: string;
  phone?: string;
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
