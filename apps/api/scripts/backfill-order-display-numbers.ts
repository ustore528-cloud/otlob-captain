/**
 * Idempotent: assigns displayOrderNo per company for rows where it is null,
 * ordered by createdAt ascending. Does not overwrite non-null displayOrderNo.
 * Continues numbering after current max per company.
 *
 * Usage:
 *   npx tsx scripts/backfill-order-display-numbers.ts           # dry-run only
 *   npx tsx scripts/backfill-order-display-numbers.ts --apply   # write
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";

function parseArgs(): { apply: boolean } {
  const apply = process.argv.includes("--apply");
  return { apply };
}

async function main() {
  const { apply } = parseArgs();

  const companyIds = await prisma.order.groupBy({
    by: ["companyId"],
    where: { displayOrderNo: null },
    _count: { _all: true },
  });

  type RowPlan = { id: string; orderNumber: string; next: number; companyId: string };
  const plans: Array<{ companyId: string; assign: RowPlan[] }> = [];
  let totalAssign = 0;

  for (const g of companyIds) {
    const companyId = g.companyId;
    const maxRow = await prisma.order.aggregate({
      where: { companyId, displayOrderNo: { not: null } },
      _max: { displayOrderNo: true },
    });
    let next = maxRow._max.displayOrderNo ?? 0;
    const orphans = await prisma.order.findMany({
      where: { companyId, displayOrderNo: null },
      orderBy: { createdAt: "asc" },
      select: { id: true, orderNumber: true },
    });
    const assign: RowPlan[] = [];
    for (const o of orphans) {
      next += 1;
      assign.push({ id: o.id, orderNumber: o.orderNumber, next, companyId });
    }
    totalAssign += assign.length;
    if (assign.length > 0) plans.push({ companyId, assign });
  }

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        companiesWithGaps: plans.length,
        rowsToAssign: totalAssign,
        sample: plans.slice(0, 3).map((p) => ({
          companyId: p.companyId,
          first: p.assign[0],
          last: p.assign[p.assign.length - 1],
          count: p.assign.length,
        })),
      },
      null,
      2,
    ),
  );

  if (!apply) {
    // eslint-disable-next-line no-console
    console.log("Re-run with --apply to write changes.");
    return;
  }

  for (const p of plans) {
    await prisma.$transaction(
      p.assign.map((r) =>
        prisma.order.update({
          where: { id: r.id },
          data: { displayOrderNo: r.next },
        }),
      ),
    );
  }

  // eslint-disable-next-line no-console
  console.log(`Updated ${totalAssign} order(s).`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
