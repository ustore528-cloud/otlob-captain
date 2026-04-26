/**
 * Exercises `listLedgerActivityReport` (read DB). Run: `npm run verify:ledger-activity-report` from `apps/api`
 */
import "dotenv/config";
import { UserRole } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";
import type { AppRole } from "../src/lib/rbac-roles.js";
import { walletReadService } from "../src/services/wallet-read.service.js";

async function main() {
  const cap = await prisma.captain.findFirst();
  if (!cap) {
    // eslint-disable-next-line no-console
    console.log("[verify-ledger-activity-report] skip: no captain");
    return;
  }
  const acct = await prisma.walletAccount.findUnique({
    where: { ownerType_ownerId: { ownerType: "CAPTAIN", ownerId: cap.id } },
  });
  if (!acct) {
    // eslint-disable-next-line no-console
    console.log("[verify-ledger-activity-report] skip: no wallet for first captain");
    return;
  }
  const le = await prisma.ledgerEntry.findFirst({
    where: { walletAccountId: acct.id },
    orderBy: { createdAt: "asc" },
  });
  if (!le) {
    // eslint-disable-next-line no-console
    console.log("[verify-ledger-activity-report] skip: no ledger for captain wallet");
    return;
  }
  const user =
    (await prisma.user.findFirst({ where: { role: UserRole.SUPER_ADMIN, isActive: true } })) ??
    (await prisma.user.findFirst({
      where: { role: UserRole.COMPANY_ADMIN, isActive: true, companyId: acct.companyId },
    })) ??
    (await prisma.user.findFirst({
      where: { role: UserRole.BRANCH_MANAGER, isActive: true, companyId: acct.companyId },
    })) ??
    (await prisma.user.findFirst({
      where: { role: UserRole.DISPATCHER, isActive: true, companyId: acct.companyId },
    }));
  if (!user) {
    // eslint-disable-next-line no-console
    console.log("[verify-ledger-activity-report] skip: no super admin or company admin for wallet company");
    return;
  }

  const t0 = new Date(le.createdAt);
  t0.setUTCHours(0, 0, 0, 0);
  const t1 = new Date(t0);
  t1.setUTCDate(t1.getUTCDate() + 1);

  const r = await walletReadService.listLedgerActivityReport(
    acct.id,
    {
      userId: user.id,
      role: user.role as AppRole,
      companyId: user.companyId ?? null,
      branchId: user.branchId ?? null,
    },
    {
      from: t0.toISOString(),
      to: t1.toISOString(),
      offset: 0,
      limit: 10,
    },
  );

  if (r.totalInRange < 0) {
    throw new Error("totalInRange should be non-negative");
  }
  if (r.totalReturned !== r.items.length) {
    throw new Error("totalReturned should match items length");
  }
  // eslint-disable-next-line no-console
  console.log("[verify-ledger-activity-report] passed", { totalInRange: r.totalInRange, returned: r.totalReturned });
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
