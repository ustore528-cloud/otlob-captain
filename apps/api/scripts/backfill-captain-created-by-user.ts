/**
 * Backfill `captains.created_by_user_id` safely when unambiguous.
 *
 * Rule:
 * - For each captain with NULL created_by_user_id:
 *   - If captain.companyId has exactly one COMPANY_ADMIN user, assign that user.
 *   - Otherwise leave NULL for manual assignment (visible to SUPER_ADMIN only paths).
 *
 * Usage:
 * - npm run tsx ./scripts/backfill-captain-created-by-user.ts -- --dry-run
 * - npm run tsx ./scripts/backfill-captain-created-by-user.ts
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

async function main() {
  const dryRun = hasFlag("--dry-run");

  const companyAdmins = await prisma.user.findMany({
    where: { role: "COMPANY_ADMIN", companyId: { not: null } },
    select: { id: true, companyId: true },
  });

  const adminsByCompany = new Map<string, string[]>();
  for (const admin of companyAdmins) {
    if (!admin.companyId) continue;
    const list = adminsByCompany.get(admin.companyId) ?? [];
    list.push(admin.id);
    adminsByCompany.set(admin.companyId, list);
  }

  const targets = await prisma.captain.findMany({
    where: { createdByUserId: null },
    select: { id: true, companyId: true },
  });

  let assignable = 0;
  const updates: Array<{ captainId: string; ownerId: string }> = [];
  for (const captain of targets) {
    const owners = adminsByCompany.get(captain.companyId) ?? [];
    if (owners.length === 1) {
      const ownerId = owners[0];
      if (ownerId) {
        updates.push({ captainId: captain.id, ownerId });
        assignable += 1;
      }
    }
  }

  // eslint-disable-next-line no-console
  console.info("[backfill-captain-created-by-user] scan", {
    dryRun,
    totalNullOwnership: targets.length,
    assignable,
    leftForManual: Math.max(0, targets.length - assignable),
  });

  if (!dryRun) {
    for (const row of updates) {
      await prisma.captain.update({
        where: { id: row.captainId },
        data: { createdByUserId: row.ownerId },
      });
    }
  }

  const afterNull = await prisma.captain.count({ where: { createdByUserId: null } });
  // eslint-disable-next-line no-console
  console.info("[backfill-captain-created-by-user] result", {
    dryRun,
    updated: dryRun ? 0 : updates.length,
    remainingNullOwnership: afterNull,
  });
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error("[backfill-captain-created-by-user] failed", e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });

