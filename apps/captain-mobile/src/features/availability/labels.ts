import type { CaptainAvailabilityStatus } from "@/services/api/dto";

export const AVAILABILITY_ORDER: CaptainAvailabilityStatus[] = [
  "AVAILABLE",
  "OFFLINE",
];

export function parseAvailabilityStatus(raw: string): CaptainAvailabilityStatus | null {
  if (raw === "AVAILABLE" || raw === "BUSY" || raw === "ON_DELIVERY") return "AVAILABLE";
  if (raw === "OFFLINE") return "OFFLINE";
  return null;
}
