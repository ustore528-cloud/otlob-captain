/**
 * Run `distributionService.autoAssignVisible` across QA-STRESS orders (AUTO + PENDING/CONFIRMED only).
 * Exercises prepaid settings prefetch + telemetry transaction options inside the batch path.
 */
import "dotenv/config";
import { DistributionMode, OrderStatus, UserRole } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";
import { distributionService } from "../src/services/distribution/index.js";
import { QA_STRESS_ORDER_PREFIX } from "./qa-stress-constants.js";

async function main() {
  const sa = await prisma.user.findFirst({
    where: { role: UserRole.SUPER_ADMIN, isActive: true },
    select: { id: true },
  });
  if (!sa) throw new Error("No active SUPER_ADMIN user found.");

  const pendingLike = await prisma.order.findMany({
    where: {
      orderNumber: { startsWith: QA_STRESS_ORDER_PREFIX },
      distributionMode: DistributionMode.AUTO,
      status: { in: [OrderStatus.PENDING, OrderStatus.CONFIRMED] },
    },
    select: { id: true, orderNumber: true },
    orderBy: { createdAt: "asc" },
  });

  const actorScope = { userId: sa.id, role: UserRole.SUPER_ADMIN, companyId: null, branchId: null } as const;

  const requestId = `qa-stress-auto-assign-visible-${Date.now()}`;
  let transactionErrors = 0;
  const errorSamples: string[] = [];

  for (const chunk of [...chunkArray(pendingLike.map((o) => o.id), 40)]) {
    try {
      const r = await distributionService.autoAssignVisible(
        { orderIds: chunk },
        sa.id,
        actorScope,
        { requestId, actorRole: UserRole.SUPER_ADMIN },
      );
      const msg = `[auto-assign-visible] chunk=${chunk.length} assigned=${r.assignedCount} skipped=${r.skippedCount}`;
      // eslint-disable-next-line no-console
      console.error(msg);
    } catch (e) {
      transactionErrors += 1;
      const m = e instanceof Error ? e.message : String(e);
      if (errorSamples.length < 12) errorSamples.push(m);
      // eslint-disable-next-line no-console
      console.error("[auto-assign-visible] chunk failed", m);
    }
  }

  const out = {
    generatedAt: new Date().toISOString(),
    superAdminId: sa.id,
    eligibleOrderCount: pendingLike.length,
    chunksProcessed: Math.ceil(pendingLike.length / 40) || 0,
    transactionChunkFailures: transactionErrors,
    errorSamples,
  };
  // eslint-disable-next-line no-console
  console.error(JSON.stringify(out, null, 2));
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
