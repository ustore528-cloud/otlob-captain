import { apiFetch } from "@/lib/api/http";
import type { DashboardSettingsDto } from "@/types/api";

/** Must match API `GET|PATCH /api/v1/dashboard-settings`. */
const DASHBOARD_SETTINGS_PATH = "/api/v1/dashboard-settings" as const;

export type DashboardSettingsPatchPayload = {
  mapCountry?: string | null;
  mapCityRegion?: string | null;
  mapDefaultLat?: number | null;
  mapDefaultLng?: number | null;
  mapDefaultZoom?: number | null;
  prepaidCaptainsEnabled?: boolean;
  prepaidDefaultCommissionPercent?: number;
  prepaidAllowCaptainCustomCommission?: boolean;
  prepaidMinimumBalanceToReceiveOrders?: number;
  prepaidAllowManualAssignmentOverride?: boolean;
};

export function getDashboardSettings(token: string): Promise<DashboardSettingsDto> {
  return apiFetch<DashboardSettingsDto>(DASHBOARD_SETTINGS_PATH, { token });
}

export function patchDashboardSettings(token: string, body: DashboardSettingsPatchPayload): Promise<DashboardSettingsDto> {
  return apiFetch<DashboardSettingsDto>(DASHBOARD_SETTINGS_PATH, {
    method: "PATCH",
    token,
    body: JSON.stringify(body),
  });
}
