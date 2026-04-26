/**
 * Phase 2.2 — Super Admin company wallet top-up verification.
 * Run: `npm run phase22:verify-super-admin-company-topup` from `apps/api`
 */
import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { LedgerEntryType, UserRole, type WalletOwnerType } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";
import { companyWalletService, type CompanyWalletActor } from "../src/services/company-wallet.service.js";
import { AppError } from "../src/utils/errors.js";
import { money } from "../src/services/ledger/money.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "..");

type Check = { id: string; pass: boolean; details?: unknown };

function assertCode(e: unknown, code: string): void {
  if (!(e instanceof AppError) || e.code !== code) {
    throw e instanceof Error ? e : new Error(String(e));
  }
}

async function countWalletsByOwner(): Promise<Record<string, number>> {
  const rows = await prisma.walletAccount.groupBy({
    by: ["ownerType"],
    _count: { _all: true },
  });
  const out: Record<string, number> = {};
  for (const r of rows) {
    out[r.ownerType] = r._count._all;
  }
  return out;
}

function actor(
  u: { id: string; role: UserRole; companyId: string | null; branchId: string | null },
): CompanyWalletActor {
  return {
    userId: u.id,
    role: u.role,
    companyId: u.companyId,
    branchId: u.branchId,
  };
}

async function main() {
  const checks: Check[] = [];
  const beforeCounts = await countWalletsByOwner();

  const superAdmin = await prisma.user.findFirst({
    where: { isActive: true, role: UserRole.SUPER_ADMIN },
  });
  if (!superAdmin) {
    throw new Error("No active SUPER_ADMIN user in database — cannot run phase22 verify.");
  }

  const companyAdmin = await prisma.user.findFirst({
    where: { isActive: true, role: UserRole.COMPANY_ADMIN, companyId: { not: null } },
  });
  if (!companyAdmin || !companyAdmin.companyId) {
    throw new Error("No active COMPANY_ADMIN with companyId — cannot run phase22 verify.");
  }

  const companyId = companyAdmin.companyId;
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company?.isActive) {
    throw new Error("Test company is missing or inactive.");
  }

  const keyBase = `phase22-cmp-${Date.now()}`;
  const sa = actor(superAdmin);

  // 1 & 2 & 3 — top-up, balance, ledger
  const t1 = await companyWalletService.superAdminTopUpCompanyWallet(sa, {
    companyId,
    amount: "11.50",
    idempotencyKey: `${keyBase}-1`,
    reason: "phase22 super admin company top-up",
  });
  if (t1.idempotent) {
    throw new Error("first top-up must not be idempotent");
  }
  const wBefore = money(t1.balanceBefore);
  const wAfter = money(t1.balanceAfter);
  if (!wAfter.minus(wBefore).equals(money("11.50"))) {
    throw new Error("balance delta must match top-up amount");
  }

  const ledger = await prisma.ledgerEntry.findUnique({ where: { id: t1.ledgerEntryId } });
  checks.push({
    id: "super_admin_topup_and_ledger",
    pass:
      Boolean(ledger) &&
      ledger!.entryType === LedgerEntryType.SUPER_ADMIN_TOP_UP &&
      ledger!.referenceType === "COMPANY" &&
      ledger!.referenceId === companyId,
    details: { ledgerEntryId: t1.ledgerEntryId, walletId: t1.walletId },
  });

  // 4 — idempotent replay
  const t2 = await companyWalletService.superAdminTopUpCompanyWallet(sa, {
    companyId,
    amount: "11.50",
    idempotencyKey: `${keyBase}-1`,
    reason: "phase22 super admin company top-up",
  });
  if (!t2.idempotent || t1.ledgerEntryId !== t2.ledgerEntryId) {
    throw new Error("idempotent replay must return same ledger entry");
  }
  if (t2.balanceAfter !== t2.balanceBefore) {
    throw new Error("idempotent replay must not change balance");
  }
  checks.push({ id: "idempotent_no_double_credit", pass: true, details: { sameLedger: true } });

  // 5 — company admin blocked
  try {
    await companyWalletService.superAdminTopUpCompanyWallet(actor(companyAdmin), {
      companyId,
      amount: "1.00",
      idempotencyKey: `${keyBase}-ca`,
      reason: "should fail",
    });
    checks.push({ id: "company_admin_forbidden", pass: false });
  } catch (e) {
    assertCode(e, "FORBIDDEN");
    checks.push({ id: "company_admin_forbidden", pass: true });
  }

  // 6 — non–super-admin (prefer captain, else dispatcher, else store user)
  const otherStaff =
    (await prisma.user.findFirst({ where: { isActive: true, role: UserRole.CAPTAIN, companyId: { not: null } } })) ??
    (await prisma.user.findFirst({ where: { isActive: true, role: UserRole.DISPATCHER, companyId: { not: null } } })) ??
    (await prisma.user.findFirst({ where: { isActive: true, role: UserRole.STORE_ADMIN, companyId: { not: null } } }));
  if (otherStaff?.companyId) {
    try {
      await companyWalletService.superAdminTopUpCompanyWallet(actor(otherStaff), {
        companyId: otherStaff.companyId,
        amount: "1.00",
        idempotencyKey: `${keyBase}-non-sa`,
        reason: "should fail",
      });
      checks.push({ id: "non_super_admin_forbidden", pass: false });
    } catch (e) {
      assertCode(e, "FORBIDDEN");
      checks.push({ id: "non_super_admin_forbidden", pass: true, details: { role: otherStaff.role } });
    }
  } else {
    checks.push({ id: "non_super_admin_forbidden", pass: true, details: { skipped: "no non-SA staff user" } });
  }

  // 7 — invalid company
  const fakeCuid = "cm0phase22invalidcuidqqqq";
  try {
    await companyWalletService.superAdminTopUpCompanyWallet(sa, {
      companyId: fakeCuid,
      amount: "1.00",
      idempotencyKey: `${keyBase}-x`,
      reason: "should fail",
    });
    checks.push({ id: "invalid_company_rejected", pass: false });
  } catch (e) {
    assertCode(e, "COMPANY_NOT_FOUND");
    checks.push({ id: "invalid_company_rejected", pass: true });
  }

  // 8 — zero / negative (service)
  try {
    await companyWalletService.superAdminTopUpCompanyWallet(sa, {
      companyId,
      amount: "0.00",
      idempotencyKey: `${keyBase}-z`,
      reason: "zero",
    });
    checks.push({ id: "non_positive_amount_rejected", pass: false });
  } catch (e) {
    assertCode(e, "LEDGER_AMOUNT_INVALID");
    checks.push({ id: "non_positive_amount_rejected", pass: true });
  }
  try {
    await companyWalletService.superAdminTopUpCompanyWallet(sa, {
      companyId,
      amount: -5,
      idempotencyKey: `${keyBase}-n`,
      reason: "neg",
    });
    checks.push({ id: "negative_amount_rejected", pass: false });
  } catch (e) {
    assertCode(e, "LEDGER_AMOUNT_INVALID");
    checks.push({ id: "negative_amount_rejected", pass: true });
  }

  const afterCounts = await countWalletsByOwner();
  const ownerTypes: WalletOwnerType[] = ["STORE", "CAPTAIN", "SUPERVISOR_USER"];
  let countOk = true;
  for (const ot of ownerTypes) {
    if ((beforeCounts[ot] ?? 0) !== (afterCounts[ot] ?? 0)) {
      countOk = false;
    }
  }
  checks.push({
    id: "other_owner_wallet_counts_unchanged",
    pass: countOk,
    details: { before: beforeCounts, after: afterCounts, watch: ownerTypes },
  });

  // 10 — verify:phase0:tenant-negative
  const v = spawnSync("npm run verify:phase0:tenant-negative", {
    cwd: apiRoot,
    shell: true,
    encoding: "utf8",
  });
  const phase0Pass = v.status === 0;
  checks.push({
    id: "verify_phase0_still_passing",
    pass: phase0Pass,
    details: phase0Pass ? { exitCode: 0 } : { exitCode: v.status, stderr: v.stderr?.slice(0, 2000) },
  });

  const failed = checks.filter((c) => !c.pass);
  const payload = {
    generatedAt: new Date().toISOString(),
    phase: "2.2",
    totalChecks: checks.length,
    failedChecks: failed.length,
    checks,
    beforeWalletCountsByOwner: beforeCounts,
    afterWalletCountsByOwner: afterCounts,
    createdTestData: { companyTopUp: "persistent ledger line + company wallet (QA)" },
    cleanupStatus: {
      note: "Company wallet/ledger not deleted (append-only + audit). Amounts are small test credits.",
    },
  };

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(payload, null, 2));

  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
