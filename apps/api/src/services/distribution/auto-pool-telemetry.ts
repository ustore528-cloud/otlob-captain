import {
  type DistributionRequestContext,
  DISTRIBUTION_TRANSACTION_OPTIONS,
} from "./distribution-engine.js";
import {
  type AutoDistributionPolicy,
  CAPTAIN_ACTIVE_WORKING_ORDER_STATUSES,
  canCaptainReceiveAutomaticOrder,
  captainPoolWhereAutoDistribution,
} from "./eligibility.js";
import {
  canAssignCaptainToOrder,
  isSuperAdminPlatformOrder,
  loadLatestCaptainLocationsTx,
} from "./assignment-eligibility.js";
import { captainPrepaidBalanceService } from "../captain-prepaid-balance.service.js";
import { prisma } from "../../lib/prisma.js";
import { UserRole } from "@prisma/client";
import type { AppRole } from "../../lib/rbac-roles.js";

/**
 * Same pool + SUPER_ADMIN branch relaxation + prepaid / capacity / zone / proximity gates as `offerNextAutoCaptainTx`
 * (no offers created). Used for tenant-scoped `autoAssignVisible` logging.
 */
export type AutoPoolOfferTelemetry = {
  orderId: string;
  companyId: string;
  branchId: string;
  /** Captains in the DB pool before per-candidate canAssignCaptainToOrder + prepaid. */
  scopedCaptainCount: number;
  /** Captains that would pass eligibility + prepaid in this evaluation pass. */
  eligibleCaptainCount: number;
  skippedForPrepaid: number;
  skippedForCapacity: number;
  /** Ineligible for zone, distance (platform), or other rules — not prepaid-only and not capacity-only. */
  skippedForOther: number;
};

export async function getAutoPoolOfferTelemetry(
  orderId: string,
  engineCtx: DistributionRequestContext | undefined,
  policy: AutoDistributionPolicy,
): Promise<AutoPoolOfferTelemetry | null> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, archivedAt: null },
      select: {
        id: true,
        branchId: true,
        companyId: true,
        ownerUserId: true,
        zoneId: true,
        pickupLat: true,
        pickupLng: true,
        createdBy: { select: { role: true } },
      },
    });
    if (!order) return null;

    const platformSaOrder = isSuperAdminPlatformOrder(order.createdBy?.role ?? null);
    const fleetCreatedByMustMatch =
      engineCtx?.bypassOrderOwnerCaptainFleetForCompanyAdmin === true
        ? undefined
        : (order.ownerUserId ?? undefined);

    const poolWhere = captainPoolWhereAutoDistribution({
      orderCompanyId: order.companyId,
      orderBranchId: order.branchId,
      restrictToOrderBranch: !platformSaOrder,
      ...(fleetCreatedByMustMatch ? { captainCreatedByUserIdMustMatch: fleetCreatedByMustMatch } : {}),
    });

    const pool = await tx.captain.findMany({
      where: poolWhere,
      orderBy: { id: "asc" },
      include: {
        user: { select: { isActive: true, role: true } },
      },
    });

    const locMap = await loadLatestCaptainLocationsTx(
      tx,
      pool.map((c) => c.id),
    );
    const applyProxGate =
      platformSaOrder && order.pickupLat != null && order.pickupLng != null;
    const actorForEligibility: AppRole = engineCtx?.actorRole ?? UserRole.DISPATCHER;

    const capacityRows = await tx.order.groupBy({
      by: ["assignedCaptainId"],
      where: {
        assignedCaptainId: { not: null },
        status: { in: CAPTAIN_ACTIVE_WORKING_ORDER_STATUSES },
      },
      _count: { _all: true },
    });
    const loadByCaptain = new Map(
      capacityRows
        .filter((r) => r.assignedCaptainId)
        .map((r) => {
          const count =
            typeof r._count === "number"
              ? r._count
              : typeof r._count === "object" && r._count
                ? (r._count._all ?? 0)
                : 0;
          return [r.assignedCaptainId as string, count] as const;
        }),
    );

    const prepaidGatingSettings = await captainPrepaidBalanceService.ensurePrepaidDashboardSettingsTx(tx);

    let eligibleCount = 0;
    let skippedForPrepaid = 0;
    let skippedForCapacity = 0;
    let skippedForOther = 0;

    for (const captain of pool) {
      const activeCount = loadByCaptain.get(captain.id) ?? 0;
      const capOk = canCaptainReceiveAutomaticOrder(activeCount, policy);

      const eligibilityCore = canAssignCaptainToOrder({
        actor: { role: actorForEligibility },
        order: {
          companyId: order.companyId,
          branchId: order.branchId,
          zoneId: order.zoneId ?? null,
          pickupLat: order.pickupLat ?? null,
          pickupLng: order.pickupLng ?? null,
          createdByRole: order.createdBy?.role ?? null,
        },
        captain: {
          id: captain.id,
          companyId: captain.companyId,
          branchId: captain.branchId,
          zoneId: captain.zoneId,
          isActive: captain.isActive,
          availabilityStatus: captain.availabilityStatus,
          user: captain.user,
        },
        mode: "AUTO_DISTRIBUTION",
        captainLatestLocation: locMap.get(captain.id) ?? null,
        activeBlockingOrderCount: activeCount,
        autoDistributionPolicy: policy,
        applySuperAdminProximityGate: applyProxGate,
      });

      const prepaid = await captainPrepaidBalanceService.getReceivingBlockReasonTx(
        tx,
        captain.id,
        prepaidGatingSettings,
      );
      const ok = eligibilityCore.allowed && !prepaid;

      if (ok) {
        eligibleCount += 1;
      } else if (prepaid) {
        skippedForPrepaid += 1;
      } else if (!capOk) {
        skippedForCapacity += 1;
      } else {
        skippedForOther += 1;
      }
    }

    return {
      orderId: order.id,
      companyId: order.companyId,
      branchId: order.branchId,
      scopedCaptainCount: pool.length,
      eligibleCaptainCount: eligibleCount,
      skippedForPrepaid,
      skippedForCapacity,
      skippedForOther,
    };
  }, DISTRIBUTION_TRANSACTION_OPTIONS);
}
