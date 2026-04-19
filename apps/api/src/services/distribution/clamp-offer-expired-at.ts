import { OFFER_CONFIRMATION_WINDOW_SECONDS } from "./constants.js";

/**
 * Caps `expiredAt` so the confirmation window never exceeds `OFFER_CONFIRMATION_WINDOW_SECONDS`
 * after `assignedAt`. Guards legacy/bad DB rows; keeps app + map aligned.
 */
export function clampOfferExpiredAtToConfiguredWindow(
  assignedAt: Date,
  expiredAt: Date | null,
): Date | null {
  if (!expiredAt) return null;
  const capMs = assignedAt.getTime() + OFFER_CONFIRMATION_WINDOW_SECONDS * 1000;
  if (expiredAt.getTime() <= capMs) return expiredAt;
  // eslint-disable-next-line no-console
  console.warn("[assignment] Clamped offer expiredAt to fixed 30s window (DB had a longer deadline)", {
    assignedAt: assignedAt.toISOString(),
    dbExpiredAt: expiredAt.toISOString(),
    capTo: new Date(capMs).toISOString(),
    offerConfirmationWindowSeconds: OFFER_CONFIRMATION_WINDOW_SECONDS,
  });
  return new Date(capMs);
}
