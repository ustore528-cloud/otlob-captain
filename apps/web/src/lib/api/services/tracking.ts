import { apiFetch, paths } from "@/lib/api/http";
import type { ActiveMapCaptain } from "@/types/api";

export type CaptainLocationRow = {
  captainId: string;
  latitude: number;
  longitude: number;
  recordedAt: string;
};

export function activeCaptainsMap(token: string): Promise<ActiveMapCaptain[]> {
  return apiFetch<ActiveMapCaptain[]>(paths.tracking.activeMap, { token });
}

export function latestCaptainLocations(token: string, captainIds: string[]): Promise<CaptainLocationRow[]> {
  const q = captainIds.length ? `?captainIds=${encodeURIComponent(captainIds.join(","))}` : "";
  return apiFetch<CaptainLocationRow[]>(`${paths.tracking.latestLocations}${q}`, { token });
}
