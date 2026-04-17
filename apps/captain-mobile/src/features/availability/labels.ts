import type { CaptainAvailabilityStatus } from "@/services/api/dto";

export const AVAILABILITY_ORDER: CaptainAvailabilityStatus[] = [
  "AVAILABLE",
  "OFFLINE",
];

export const availabilityLabel: Record<CaptainAvailabilityStatus, string> = {
  AVAILABLE: "فعال",
  OFFLINE: "غير فعال",
  BUSY: "فعال",
  ON_DELIVERY: "فعال",
};

export const availabilityHint: Record<CaptainAvailabilityStatus, string> = {
  AVAILABLE: "يستقبل الطلبات الجديدة",
  OFFLINE: "لا يستقبل طلبات جديدة",
  BUSY: "يستقبل الطلبات الجديدة",
  ON_DELIVERY: "يستقبل الطلبات الجديدة",
};

export function parseAvailabilityStatus(raw: string): CaptainAvailabilityStatus | null {
  if (raw === "AVAILABLE" || raw === "BUSY" || raw === "ON_DELIVERY") return "AVAILABLE";
  if (raw === "OFFLINE") return "OFFLINE";
  return null;
}
