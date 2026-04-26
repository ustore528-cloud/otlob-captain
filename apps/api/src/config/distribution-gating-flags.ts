/**
 * When true (default), prepaid gating and policy `currentBalance` / `blockedFromReceivingOrders` / `lowBalance`
 * use the same aligned scalar as read-alignment: wallet `balanceCached` if a captain wallet row exists, else
 * `captain.prepaidBalance`. Set to `"false"` / `"0"` to restore prepaid-only behavior (rollback / shadow period).
 */
const alignedRaw = process.env.DISTRIBUTION_GATING_USE_ALIGNED_BALANCE?.toLowerCase().trim();
export const DISTRIBUTION_GATING_USE_ALIGNED_BALANCE = alignedRaw !== "false" && alignedRaw !== "0";

/**
 * If `"1"` / `true`, log when `captain.prepaidBalance` ≠ wallet `balanceCached` (no request failure, support signal).
 */
const shadowRaw = process.env.DISTRIBUTION_GATING_SHADOW_LOG?.toLowerCase().trim();
export const DISTRIBUTION_GATING_SHADOW_LOG = shadowRaw === "1" || shadowRaw === "true";
