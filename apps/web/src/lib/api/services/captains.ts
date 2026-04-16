import { apiFetch, paths } from "@/lib/api/http";
import type { CaptainListItem, CaptainStats, Paginated } from "@/types/api";

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
