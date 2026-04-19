import { env } from "../../config/env.js";

/**
 * Product rule: captain must accept/reject within exactly this many seconds.
 * Not configurable via env — prevents deploy misconfiguration (e.g. 200–300s windows).
 */
export const OFFER_CONFIRMATION_WINDOW_SECONDS = 30;

/** @deprecated Use OFFER_CONFIRMATION_WINDOW_SECONDS — kept as alias for existing imports */
export const DISTRIBUTION_TIMEOUT_SECONDS = OFFER_CONFIRMATION_WINDOW_SECONDS;

export const DISTRIBUTION_MAX_AUTO_ATTEMPTS = env.DISTRIBUTION_MAX_ATTEMPTS;

/** حد الحمل التلقائي لكل كابتن في نفس الوقت (اليدوي غير مقيّد). */
export const AUTO_CAPTAIN_MAX_ACTIVE_ORDERS = 2;

export const ASSIGNMENT_TIMEOUT_NOTE = (seconds: number) =>
  `TIMEOUT: no response within ${seconds}s (round-robin advance)`;
