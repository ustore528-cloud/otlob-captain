import type { TFunction } from "i18next";
import type { CaptainAvailabilityStatus } from "@/services/api/dto";

export function availabilityLabelT(status: CaptainAvailabilityStatus, t: TFunction): string {
  if (status === "OFFLINE") return t("availability.labelOffline");
  return t("availability.labelActive");
}

export function availabilityHintT(status: CaptainAvailabilityStatus, t: TFunction): string {
  if (status === "OFFLINE") return t("availability.hintOffline");
  return t("availability.hintActive");
}
