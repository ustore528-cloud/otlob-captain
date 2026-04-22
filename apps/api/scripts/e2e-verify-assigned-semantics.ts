/**
 * Live verification (needs DB) for ASSIGNED/OFFER vs ACTIVE semantics and default auto blocking.
 *
 * Prereq: at least one order in ASSIGNED + pending assignment-offer state.
 * Typical setup: `npm run db:demo-reset` (creates a demo order and runs auto distribution).
 *
 * Run from `apps/api`: `npm run verify:e2e-assigned-semantics`
 */
import "dotenv/config";
import { AssignmentResponseStatus, OrderStatus } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";
import { captainMobileService } from "../src/services/captain-mobile.service.js";
import {
  canCaptainReceiveAutomaticOrder,
  CAPTAIN_ACTIVE_WORKING_ORDER_STATUSES,
} from "../src/services/distribution/eligibility.js";

async function main() {
  const now = new Date();
  const pendingLog = await prisma.orderAssignmentLog.findFirst({
    where: {
      responseStatus: AssignmentResponseStatus.PENDING,
      OR: [{ expiredAt: null }, { expiredAt: { gt: now } }],
      order: {
        status: OrderStatus.ASSIGNED,
        assignedCaptainId: { not: null },
      },
    },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          assignedCaptainId: true,
          assignedCaptain: { select: { userId: true } },
        },
      },
    },
  });

  if (!pendingLog?.order?.assignedCaptain?.userId) {
    // eslint-disable-next-line no-console
    console.error(
      "[e2e-assigned] No ASSIGNED + pending-offer row found. Run: npm run db:demo-reset",
    );
    process.exit(1);
  }

  const userId = pendingLog.order.assignedCaptain.userId;
  const orderId = pendingLog.order.id;
  const { assignedCaptainId } = pendingLog.order;
  if (!assignedCaptainId) throw new Error("missing assignedCaptainId");

  const snapOffer = await captainMobileService.getCurrentAssignment(userId);
  if (snapOffer.state !== "OFFER") {
    throw new Error(`Expected getCurrentAssignment → OFFER while ASSIGNED+pending, got ${snapOffer.state}`);
  }
  if (snapOffer.state === "OFFER" && snapOffer.order.status !== OrderStatus.ASSIGNED) {
    throw new Error(`OFFER snapshot must carry order.status ASSIGNED, got ${snapOffer.order.status}`);
  }
  // eslint-disable-next-line no-console
  console.info("[e2e-assigned] PASS: ASSIGNED + pending log → API state OFFER");

  const activeLoad = await prisma.order.count({
    where: {
      assignedCaptainId,
      status: { in: CAPTAIN_ACTIVE_WORKING_ORDER_STATUSES },
    },
  });
  if (activeLoad < 1) {
    throw new Error(`Expected at least 1 active-working order for captain, got ${activeLoad}`);
  }
  if (canCaptainReceiveAutomaticOrder(activeLoad, "DEFAULT_SINGLE_ORDER")) {
    throw new Error(
      "Expected captain blocked from another default automatic order while holding ASSIGNED (load>=1)",
    );
  }
  // eslint-disable-next-line no-console
  console.info(
    "[e2e-assigned] PASS: default auto policy blocks second offer while first is still ASSIGNED (capacity)",
  );

  await captainMobileService.acceptOrder(orderId, userId);
  const snapActive = await captainMobileService.getCurrentAssignment(userId);
  if (snapActive.state !== "ACTIVE") {
    throw new Error(`Expected getCurrentAssignment → ACTIVE after accept, got ${snapActive.state}`);
  }
  if (snapActive.state === "ACTIVE" && snapActive.order.status !== OrderStatus.ACCEPTED) {
    throw new Error(`ACTIVE snapshot must carry order.status ACCEPTED after accept, got ${snapActive.order.status}`);
  }
  // eslint-disable-next-line no-console
  console.info("[e2e-assigned] PASS: accept → API state ACTIVE with order.status ACCEPTED");

  // eslint-disable-next-line no-console
  console.info("[e2e-assigned] all checks passed");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
