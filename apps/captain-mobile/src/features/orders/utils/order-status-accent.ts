import { homeTheme } from "@/features/home/theme";
import type { OrderStatusDto } from "@/services/api/dto";

export type StatusAccent = { bg: string; border: string; text: string };

/**
 * Visual treatment for each API order status (captain-facing).
 *
 * Maps to workflow steps: offer → accepted (incl. heading to pickup) → picked up → in transit → delivered.
 * `IN_TRANSIT` uses the strongest fill/border in this set so «في الطريق للعميل» is obvious at a glance.
 * `PENDING` / `CONFIRMED` are pre-offer queue; `CANCELLED` is terminal error.
 *
 * **Single source of truth** for status pills on: order list card, order detail, workbench card, assignment bundle.
 */
export function orderStatusAccent(status: OrderStatusDto): StatusAccent {
  switch (status) {
    case "ASSIGNED":
      return {
        bg: homeTheme.statusOfferSoft,
        border: homeTheme.statusOfferBorder,
        text: homeTheme.statusOfferText,
      };
    case "ACCEPTED":
      return {
        bg: homeTheme.statusAcceptedSoft,
        border: homeTheme.statusAcceptedBorder,
        text: homeTheme.statusAcceptedText,
      };
    case "PICKED_UP":
      return {
        bg: homeTheme.goldSoft,
        border: homeTheme.goldMuted,
        text: homeTheme.gold,
      };
    case "IN_TRANSIT":
      return {
        bg: homeTheme.statusTransitSoft,
        border: homeTheme.statusTransitBorder,
        text: homeTheme.statusTransitText,
      };
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
    case "PENDING":
    case "CONFIRMED":
      return {
        bg: homeTheme.neutralSoft,
        border: homeTheme.border,
        text: homeTheme.textMuted,
      };
    default:
      return {
        bg: homeTheme.neutralSoft,
        border: homeTheme.border,
        text: homeTheme.textMuted,
      };
  }
}
