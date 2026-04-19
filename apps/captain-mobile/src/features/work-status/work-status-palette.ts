import type { QuickWorkStatusCode } from "@/services/api/dto/captain.dto";

export const WORK_STATUS_PALETTE: Record<
  QuickWorkStatusCode,
  { bg: string; border: string; text: string; icon: "alert-circle-outline" | "trending-down-outline" | "flash-outline" | "flame-outline" }
> = {
  PRESSURE: {
    bg: "rgba(176, 36, 50, 0.11)",
    border: "rgba(176, 36, 50, 0.28)",
    text: "#8A1E2A",
    icon: "alert-circle-outline",
  },
  LOW_ACTIVITY: {
    bg: "rgba(90, 120, 150, 0.12)",
    border: "rgba(90, 120, 150, 0.28)",
    text: "#3D5566",
    icon: "trending-down-outline",
  },
  RAISE_READINESS: {
    bg: "rgba(201, 166, 70, 0.16)",
    border: "rgba(201, 166, 70, 0.38)",
    text: "#7A5F12",
    icon: "flash-outline",
  },
  ON_FIRE: {
    bg: "rgba(200, 90, 40, 0.14)",
    border: "rgba(200, 90, 40, 0.35)",
    text: "#A14A18",
    icon: "flame-outline",
  },
};
