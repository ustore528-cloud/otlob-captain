/**
 * Sample audit line for `canAssignCaptainToOrder`: order + captain snapshot, distance, decision.
 * Run from repo root: `npm run verify:assignment-eligibility-sample -w @captain/api`
 *
 * Detailed engine logs during real assigns: `ASSIGN_ELIGIBILITY_AUDIT=1` plus distribution actions.
 */
import "dotenv/config";
import { UserRole } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import type { AppRole } from "../src/lib/rbac-roles.js";
import { prisma } from "../src/lib/prisma.js";
import {
  canAssignCaptainToOrder,
  isSuperAdminPlatformOrder,
  loadLatestCaptainLocationsTx,
  haversineDistanceMeters,
} from "../src/services/distribution/assignment-eligibility.js";
import {
  captainPoolWhereAutoDistribution,
  CAPTAIN_ACTIVE_WORKING_ORDER_STATUSES,
  captainEligibleForManualOverride,
} from "../src/services/distribution/eligibility.js";

async function main() {
  const order = await prisma.order.findFirst({
    where: { archivedAt: null },
    select: {
      id: true,
      orderNumber: true,
      companyId: true,
      branchId: true,
      zoneId: true,
      pickupLat: true,
      pickupLng: true,
      createdBy: { select: { role: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const actorRole: AppRole = UserRole.DISPATCHER;
  const createdByRole = order?.createdBy?.role ?? null;
  const platformSa = isSuperAdminPlatformOrder(createdByRole);

  if (!order) {
    // eslint-disable-next-line no-console
    console.info(JSON.stringify({ note: "no orders in DB; nothing to evaluate" }, null, 2));
    return;
  }

  const poolWhere = captainPoolWhereAutoDistribution({
    orderCompanyId: order.companyId,
    orderBranchId: order.branchId,
    restrictToOrderBranch: !platformSa,
  });
  const captains = await prisma.captain.findMany({
    where: poolWhere,
    take: 3,
    orderBy: { id: "asc" },
    include: { user: { select: { isActive: true, role: true, fullName: true, phone: true } } },
  });

  const txCompat = prisma as unknown as Prisma.TransactionClient;
  const locMap = await loadLatestCaptainLocationsTx(txCompat, captains.map((c) => c.id));
  const applyProxGate =
    platformSa && order.pickupLat != null && order.pickupLng != null;

  const samples: Record<string, unknown>[] = [];

  for (const c of captains) {
    const ping = locMap.get(c.id) ?? null;
    let distanceMeters: number | null = null;
    if (order.pickupLat != null && order.pickupLng != null && ping) {
      distanceMeters = haversineDistanceMeters(
        { lat: order.pickupLat, lng: order.pickupLng },
        ping,
      );
    }

    const activeBlockingOrderCount = await prisma.order.count({
      where: {
        assignedCaptainId: c.id,
        status: { in: CAPTAIN_ACTIVE_WORKING_ORDER_STATUSES },
      },
    });

    const autoEv = canAssignCaptainToOrder({
      actor: { role: actorRole },
      order: {
        companyId: order.companyId,
        branchId: order.branchId,
        zoneId: order.zoneId ?? null,
        pickupLat: order.pickupLat ?? null,
        pickupLng: order.pickupLng ?? null,
        createdByRole,
      },
      captain: {
        id: c.id,
        companyId: c.companyId,
        branchId: c.branchId,
        zoneId: c.zoneId,
        isActive: c.isActive,
        availabilityStatus: c.availabilityStatus,
        user: c.user,
      },
      mode: "AUTO_DISTRIBUTION",
      captainLatestLocation: ping,
      activeBlockingOrderCount,
      autoDistributionPolicy: "DEFAULT_SINGLE_ORDER",
      applySuperAdminProximityGate: applyProxGate,
    });

    const manualEligible = captainEligibleForManualOverride(c);
    samples.push({
      orderNumber: order.orderNumber,
      orderCompanyId: order.companyId,
      orderBranchId: order.branchId,
      orderCreatedByRole: createdByRole,
      platformSaOrder: platformSa,
      pickupCoords:
        order.pickupLat != null && order.pickupLng != null
          ? { lat: order.pickupLat, lng: order.pickupLng }
          : null,
      captainName: c.user.fullName,
      captainPhone: c.user.phone,
      captainCompanyId: c.companyId,
      captainBranchId: c.branchId,
      distanceFromPickupMeters: distanceMeters,
      pingPresent: ping != null,
      manualEligibleOverrideStyle: manualEligible,
      autoDistribution: {
        allowed: autoEv.allowed,
        reasonCode: autoEv.reasonCode,
      },
    });
  }

  // eslint-disable-next-line no-console
  console.info(
    JSON.stringify(
      {
        at: new Date().toISOString(),
        actorRole,
        evaluations: samples,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
