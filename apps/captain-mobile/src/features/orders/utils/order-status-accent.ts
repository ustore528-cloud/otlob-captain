import { homeTheme } from "@/features/home/theme";
import type { OrderStatusDto } from "@/services/api/dto";

export type StatusAccent = { bg: string; border: string; text: string };

export function orderStatusAccent(status: OrderStatusDto): StatusAccent {
  switch (status) {
    case "DELIVERED":
      return {
        bg: homeTheme.successSoft,
        border: homeTheme.successBorder,
        text: homeTheme.successText,
      };
    case "CANCELLED":
      return {
        bg: homeTheme.dangerSoft,
        border: homeTheme.dangerBorder,
        text: homeTheme.dangerText,
      };
    case "IN_TRANSIT":
    case "PICKED_UP":
      return {
        bg: homeTheme.goldSoft,
        border: homeTheme.goldMuted,
        text: homeTheme.gold,
      };
    case "ASSIGNED":
    case "ACCEPTED":
      return { bg: homeTheme.accentSoft, border: homeTheme.borderStrong, text: homeTheme.accent };
    default:
      return { bg: homeTheme.neutralSoft, border: homeTheme.border, text: homeTheme.textMuted };
  }
}
