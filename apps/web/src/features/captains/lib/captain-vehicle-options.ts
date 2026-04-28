import type { TFunction } from "i18next";

/** API/backend stores these Arabic vehicle labels as `Captain.vehicleType`; UI labels translate via `captains.legacyVehicle.*`. */
export const CAPTAIN_VEHICLE_OPTIONS = [
  { value: "بسكليت", labelKey: "captains.legacyVehicle.bicycle" },
  { value: "دراجه ناريه", labelKey: "captains.legacyVehicle.motorcycle" },
  { value: "سيارة", labelKey: "captains.legacyVehicle.car" },
  { value: "شحن نقل", labelKey: "captains.legacyVehicle.cargoVan" },
] as const;

export type CaptainVehicleApiValue = (typeof CAPTAIN_VEHICLE_OPTIONS)[number]["value"];

export const DEFAULT_CAPTAIN_VEHICLE_VALUE: CaptainVehicleApiValue = "دراجه ناريه";

export function captainVehicleLabel(apiValue: string | undefined | null, t: TFunction): string {
  if (!apiValue) return "";
  const hit = CAPTAIN_VEHICLE_OPTIONS.find((o) => o.value === apiValue);
  return hit ? String(t(hit.labelKey)) : apiValue;
}
