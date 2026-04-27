import type { DistributionRequestContext } from "./distribution-engine.js";
import {
  canCaptainReceiveAutomaticOrder,
  eligibleCaptainsForAutoDistribution,
  type AutoDistributionPolicy,
  CAPTAIN_ACTIVE_WORKING_ORDER_STATUSES,
} from "./eligibility.js";
import { captainPrepaidBalanceService } from "../captain-prepaid-balance.service.js";
import { prisma } from "../../lib/prisma.js";

/**
 * Same branch pool + same owner / Company Admin bypass as `offerNextAutoCaptainTx` (no offers created).
 * Used for tenant-scoped `autoAssignVisible` logging.
 */
export type AutoPoolOfferTelemetry = {
  orderId: string;
  companyId: string;
  branchId: string;
  /** Captains in the auto pool (before prepaid/capacity). */
  scopedCaptainCount: number;
  /** Captains that would pass both capacity and prepaid in this evaluation pass. */
  eligibleCaptainCount: number;
  skippedForPrepaid: number;
  skippedForCapacity: number;
};

export async function getAutoPoolOfferTelemetry(
  orderId: string,
  engineCtx: DistributionRequestContext | undefined,
  policy: AutoDistributionPolicy,
): Promise<AutoPoolOfferTelemetry | null> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, archivedAt: null },
      select: { id: true, branchId: true, companyId: true, ownerUserId: true },
    });
    if (!order) return null;

    const orderOwnerForPool =
      engineCtx?.bypassOrderOwnerCaptainFleetForCompanyAdmin === true
        ? null
        : (order.ownerUserId ?? null);
    const where = eligibleCaptainsForAutoDistribution(order.branchId, orderOwnerForPool);
    const pool = await tx.captain.findMany({
      where,
      orderBy: { id: "asc" },
    });

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

    let eligibleCount = 0;
    let skippedForPrepaid = 0;
    let skippedForCapacity = 0;
    for (const captain of pool) {
      const activeCount = loadByCaptain.get(captain.id) ?? 0;
      const capOk = canCaptainReceiveAutomaticOrder(activeCount, policy);
      if (!capOk) {
        skippedForCapacity += 1;
        continue;
      }
      const prepaid = await captainPrepaidBalanceService.getReceivingBlockReasonTx(tx, captain.id);
      if (prepaid) {
        skippedForPrepaid += 1;
        continue;
      }
      eligibleCount += 1;
    }

    return {
      orderId: order.id,
      companyId: order.companyId,
      branchId: order.branchId,
      scopedCaptainCount: pool.length,
      eligibleCaptainCount: eligibleCount,
      skippedForPrepaid,
      skippedForCapacity,
    };
  });
}
