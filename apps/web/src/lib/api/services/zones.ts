import { apiFetch, paths } from "@/lib/api/http";

export type ZoneListItem = {
  id: string;
  name: string;
  cityId: string;
  cityName: string;
};

export function listZones(token: string, q: { companyId?: string } = {}): Promise<ZoneListItem[]> {
  const p = new URLSearchParams();
  if (q.companyId) p.set("companyId", q.companyId);
  const suffix = p.toString() ? `?${p.toString()}` : "";
  return apiFetch<ZoneListItem[]>(`${paths.zones.root}${suffix}`, { token });
}
