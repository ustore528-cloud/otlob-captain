import type { Request, Response } from "express";
import { ok } from "../utils/api-response.js";
import { getDashboardSettings, patchDashboardSettings } from "../services/dashboard-settings.service.js";
import type { DashboardSettingsPatchBody } from "../validators/dashboard-settings.schemas.js";

function normalizePatch(body: DashboardSettingsPatchBody) {
  const mapCountry =
    body.mapCountry === undefined ? undefined : body.mapCountry === "" || body.mapCountry === null ? null : body.mapCountry;
  const mapCityRegion =
    body.mapCityRegion === undefined
      ? undefined
      : body.mapCityRegion === "" || body.mapCityRegion === null
        ? null
        : body.mapCityRegion;

  return {
    ...(mapCountry !== undefined && { mapCountry }),
    ...(mapCityRegion !== undefined && { mapCityRegion }),
    ...(body.mapDefaultLat !== undefined && { mapDefaultLat: body.mapDefaultLat }),
    ...(body.mapDefaultLng !== undefined && { mapDefaultLng: body.mapDefaultLng }),
    ...(body.mapDefaultZoom !== undefined && { mapDefaultZoom: body.mapDefaultZoom }),
    ...(body.prepaidCaptainsEnabled !== undefined && { prepaidCaptainsEnabled: body.prepaidCaptainsEnabled }),
    ...(body.prepaidDefaultCommissionPercent !== undefined && {
      prepaidDefaultCommissionPercent: body.prepaidDefaultCommissionPercent,
    }),
    ...(body.prepaidAllowCaptainCustomCommission !== undefined && {
      prepaidAllowCaptainCustomCommission: body.prepaidAllowCaptainCustomCommission,
    }),
    ...(body.prepaidMinimumBalanceToReceiveOrders !== undefined && {
      prepaidMinimumBalanceToReceiveOrders: body.prepaidMinimumBalanceToReceiveOrders,
    }),
    ...(body.prepaidAllowManualAssignmentOverride !== undefined && {
      prepaidAllowManualAssignmentOverride: body.prepaidAllowManualAssignmentOverride,
    }),
  };
}

export const dashboardSettingsController = {
  get: async (_req: Request, res: Response) => {
    const data = await getDashboardSettings();
    return res.json(ok(data));
  },

  patch: async (req: Request, res: Response) => {
    const body = req.body as DashboardSettingsPatchBody;
    const data = await patchDashboardSettings(normalizePatch(body));
    return res.json(ok(data));
  },
};
