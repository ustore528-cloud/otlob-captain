/**
 * Source of truth for “seconds left” on both:
 * - Web dispatcher map (`assignmentOfferSecondsLeft` in `captain-map-visual.ts`)
 * - Mobile (`useAssignmentOfferSecondsTick` ← GET `/mobile/captain/me/assignment` → `log.expiresAt` = DB `orderAssignmentLog.expiredAt`, set in distribution engine from fixed `OFFER_CONFIRMATION_WINDOW_SECONDS` (30s))
 *
 * Derivation: `Math.ceil` of seconds until `expiresAt` ISO (UTC), clamped at 0 — same formula as web.
 */
export function assignmentOfferSecondsLeft(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 1000));
}

/** Same visible string as dispatcher map markers (`⏱ N ث`) — use everywhere offer time is shown. */
export function formatAssignmentOfferCountdownAr(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `⏱ ${s} ث`;
}
