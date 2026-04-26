import { CaptainAvailabilityStatus, OrderStatus, UserRole, type Prisma } from "@prisma/client";
import {
  DEFAULT_AUTO_CAPTAIN_MAX_ACTIVE_ORDERS,
  OVERRIDE_AUTO_CAPTAIN_MAX_ACTIVE_ORDERS,
} from "./constants.js";

/**
 * شروط التوزيع التلقائي (Round Robin):
 * - المستخدم: role = CAPTAIN, isActive = true
 * - ملف الكابتن: isActive = true, availabilityStatus = AVAILABLE
 * - نفس فرع الطلب (عزل متعدد المستأجرين)
 */
export function eligibleCaptainsForAutoDistribution(
  branchId: string,
  orderOwnerUserId?: string | null,
): Prisma.CaptainWhereInput {
  const base: Prisma.CaptainWhereInput = {
    branchId,
    isActive: true,
    availabilityStatus: CaptainAvailabilityStatus.AVAILABLE,
    user: {
      isActive: true,
      role: UserRole.CAPTAIN,
    },
  };
  if (orderOwnerUserId) {
    return { ...base, createdByUserId: orderOwnerUserId };
  }
  return base;
}

/**
 * Authoritative active-working states for captain workload checks.
 * Reuse this list anywhere we decide whether a captain is "busy".
 *
 * @see ./assigned-order-semantics.ts — how `ASSIGNED` relates to mobile OFFER vs ACTIVE and auto blocking.
 */
export const CAPTAIN_ACTIVE_WORKING_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.ASSIGNED,
  OrderStatus.ACCEPTED,
  OrderStatus.PICKED_UP,
  OrderStatus.IN_TRANSIT,
];

export type AutoDistributionPolicy = "DEFAULT_SINGLE_ORDER" | "OVERRIDE_MULTI_ORDER";

export function maxActiveOrdersForAutoDistributionPolicy(policy: AutoDistributionPolicy): number {
  return policy === "OVERRIDE_MULTI_ORDER"
    ? OVERRIDE_AUTO_CAPTAIN_MAX_ACTIVE_ORDERS
    : DEFAULT_AUTO_CAPTAIN_MAX_ACTIVE_ORDERS;
}

export function captainHasActiveWorkingOrder(activeWorkingOrdersCount: number): boolean {
  return activeWorkingOrdersCount > 0;
}

export type AutomaticMultiOrderOverrideGateInput = {
  /** Explicit feature/operation flag (must be intentionally set by caller). */
  manualMultiOrderOverrideEnabled: boolean;
  /** Optional audit-friendly source tag (e.g. "DISPATCHER_OVERRIDE", "EMERGENCY_MODE"). */
  overrideSource?: string | null;
};

export function isManualMultiOrderOverrideEnabled(
  gate: AutomaticMultiOrderOverrideGateInput,
): boolean {
  return gate.manualMultiOrderOverrideEnabled === true;
}

export function canBypassAutomaticSingleOrderRule(
  gate: AutomaticMultiOrderOverrideGateInput,
): boolean {
  // Require explicit enablement + traceable source.
  return isManualMultiOrderOverrideEnabled(gate) && Boolean(gate.overrideSource?.trim());
}

/** Single source of truth: captain busy check by explicit automatic-distribution policy. */
export function isCaptainBusyForAutomaticDistribution(
  activeWorkingOrdersCount: number,
  policy: AutoDistributionPolicy = "DEFAULT_SINGLE_ORDER",
): boolean {
  return activeWorkingOrdersCount >= maxActiveOrdersForAutoDistributionPolicy(policy);
}

/** Complementary helper for readability at call sites. */
export function canCaptainReceiveAutomaticOrder(
  activeWorkingOrdersCount: number,
  policy: AutoDistributionPolicy = "DEFAULT_SINGLE_ORDER",
): boolean {
  return !isCaptainBusyForAutomaticDistribution(activeWorkingOrdersCount, policy);
}

/** تعيين يدوي / سحب-وإفلات: كابتن فعّال بحساب CAPTAIN نشط (يسمح بتوفر غير AVAILABLE للتجاوز اليدوي) */
export function captainEligibleForManualOverride(captain: {
  isActive: boolean;
  availabilityStatus: CaptainAvailabilityStatus;
  user: { isActive: boolean; role: UserRole };
}): boolean {
  if (!captain.isActive || !captain.user.isActive) return false;
  if (captain.user.role !== UserRole.CAPTAIN) return false;
  return true;
}
