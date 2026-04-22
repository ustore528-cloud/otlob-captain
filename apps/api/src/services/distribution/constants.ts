import { env } from "../../config/env.js";

/**
 * Product rule: captain must accept/reject within exactly this many seconds.
 * Not configurable via env — prevents deploy misconfiguration (e.g. 200–300s windows).
 */
export const OFFER_CONFIRMATION_WINDOW_SECONDS = 30;

/** @deprecated Use OFFER_CONFIRMATION_WINDOW_SECONDS — kept as alias for existing imports */
export const DISTRIBUTION_TIMEOUT_SECONDS = OFFER_CONFIRMATION_WINDOW_SECONDS;

export const DISTRIBUTION_MAX_AUTO_ATTEMPTS = env.DISTRIBUTION_MAX_ATTEMPTS;

/**
 * Default product policy:
 * automatic distribution is single-order-only.
 */
export const DEFAULT_AUTO_CAPTAIN_MAX_ACTIVE_ORDERS = 1;

/**
 * Explicit override policy for automatic mode (must be enabled intentionally by an override path).
 * This is NOT the default behavior.
 */
export const OVERRIDE_AUTO_CAPTAIN_MAX_ACTIVE_ORDERS = 2;

export const ASSIGNMENT_TIMEOUT_NOTE = (seconds: number) =>
  `TIMEOUT: no response within ${seconds}s (round-robin advance)`;
