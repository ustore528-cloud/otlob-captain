import { env } from "../../config/env.js";
import { OFFER_CONFIRMATION_WINDOW_SECONDS } from "./constants.js";

/** Structured stdout when `OFFER_DIAGNOSTICS=1` — use for a single test offer/captain trace. */
export function logOfferCreationDiagnostics(ctx: {
  phase: string;
  orderId: string;
  captainId: string;
  assignedAt: Date;
  expiredAt: Date;
}): void {
  if (env.OFFER_DIAGNOSTICS !== "1") return;
  const deltaSec = (ctx.expiredAt.getTime() - ctx.assignedAt.getTime()) / 1000;
  // eslint-disable-next-line no-console
  console.info("[offer-diagnostics] offer_row_inserted", {
    phase: ctx.phase,
    orderId: ctx.orderId,
    captainId: ctx.captainId,
    offerWindowSecondsFixed: OFFER_CONFIRMATION_WINDOW_SECONDS,
    assignedAtIso: ctx.assignedAt.toISOString(),
    expiredAtIso: ctx.expiredAt.toISOString(),
    deltaSeconds: deltaSec,
  });
}

export function logOfferPayloadCaptainMobileDiagnostics(ctx: {
  orderId: string;
  captainId: string;
  assignedAtIso: string;
  expiresAtIso: string | null;
}): void {
  if (env.OFFER_DIAGNOSTICS !== "1") return;
  // eslint-disable-next-line no-console
  console.info("[offer-diagnostics] payload_captain_app_assignment", ctx);
}

export function logOfferPayloadTrackingMapDiagnostics(ctx: {
  captainId: string;
  assignmentOfferExpiresAtIso: string | null;
}): void {
  if (env.OFFER_DIAGNOSTICS !== "1") return;
  // eslint-disable-next-line no-console
  console.info("[offer-diagnostics] payload_dashboard_map_captain", ctx);
}
