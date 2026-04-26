/**
 * Phase 2.6.1 — Company Admin store wallet top-up (service + route) verification.
 * Run: `npm run phase261:verify-company-admin-store-topup` from `apps/api`
 *
 * Uses a small positive amount and QA idempotency keys. Does not delete ledger history.
 */
import "dotenv/config";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { LedgerEntryType, UserRole, WalletOwnerType, type Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";
import { companyAdminTopUpStoreWallet } from "../src/services/company-admin-wallet-topup.service.js";
import { companyWalletService, type CompanyWalletActor } from "../src/services/company-wallet.service.js";
import { superAdminWalletTopupService } from "../src/services/super-admin-wallet-topup.service.js";
import { AppError } from "../src/utils/errors.js";
import { money } from "../src/services/ledger/money.js";
import { ROLE_GROUPS } from "../src/lib/rbac-roles.js";
import type { AppRole } from "../src/lib/rbac-roles.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "..");

type Check = { id: string; pass: boolean; details?: unknown };

function assertCode(e: unknown, code: string): void {
  if (!(e instanceof AppError) || e.code !== code) {
    throw e instanceof Error ? e : new Error(String(e));
  }
}

function companyActor(
  u: { id: string; role: UserRole; companyId: string | null; branchId: string | null },
): CompanyWalletActor {
  return { userId: u.id, role: u.role, companyId: u.companyId, branchId: u.branchId };
}

function storeTopUpActor(u: {
  id: string;
  role: UserRole;
  companyId: string | null;
  branchId: string | null;
}): { userId: string; role: AppRole; companyId: string | null; branchId: string | null } {
  return { userId: u.id, role: u.role as AppRole, companyId: u.companyId, branchId: u.branchId };
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

function isMetadataSource(ledger: { metadata: Prisma.JsonValue | null }): boolean {
  if (!ledger.metadata || typeof ledger.metadata !== "object" || Array.isArray(ledger.metadata)) {
    return false;
  }
  const o = ledger.metadata as Record<string, unknown>;
  return o.source === "company_admin_store_wallet_topup" && typeof o.reason === "string";
}

async function main() {
  const checks: Check[] = [];
  const beforeCounts = await countWalletsByOwner();
  const runKey = `p261-qa-${Date.now()}`;

  const sa = await prisma.user.findFirst({ where: { isActive: true, role: UserRole.SUPER_ADMIN } });
  if (!sa) {
    throw new Error("No active SUPER_ADMIN in DB");
  }
  const ca = await prisma.user.findFirst({
    where: { isActive: true, role: UserRole.COMPANY_ADMIN, companyId: { not: null } },
  });
  if (!ca?.companyId) {
    throw new Error("No active COMPANY_ADMIN with companyId in DB");
  }
  const otherCo = await prisma.company.findFirst({
    where: { isActive: true, id: { not: ca.companyId } },
  });
  if (!otherCo) {
    throw new Error("Need a second company for cross-tenant checks.");
  }

  const testWallet = await prisma.walletAccount.findFirst({
    where: { ownerType: WalletOwnerType.STORE, companyId: ca.companyId },
  });
  if (!testWallet) {
    throw new Error(`No existing STORE wallet for company ${ca.companyId} — seed or create one first.`);
  }
  const ourStore = await prisma.store.findUniqueOrThrow({ where: { id: testWallet.ownerId } });
  if (ourStore.companyId !== ca.companyId) {
    throw new Error("Store / wallet company mismatch in test data.");
  }

  const otherStore = await prisma.store.findFirst({
    where: { companyId: otherCo.id, isActive: true },
  });
  if (!otherStore) {
    throw new Error("No store in the other company for cross-tenant test.");
  }

  const testAmount = "0.04";
  const idemClient = `idem-${runKey}`;

  // 1 — own-company top-up, balance + ledger
  const t1 = await companyAdminTopUpStoreWallet(storeTopUpActor(ca), {
    storeId: ourStore.id,
    amount: testAmount,
    reason: "phase 2.6.1 CA store top-up verify",
    idempotencyKey: idemClient,
  });
  if (t1.idempotent) {
    throw new Error("first call must not be idempotent");
  }
  if (!money(t1.balanceAfter).minus(money(t1.balanceBefore)).equals(money(testAmount))) {
    checks.push({ id: "ca_balance_delta", pass: false, details: t1 });
  } else {
    checks.push({ id: "ca_balance_delta", pass: true, details: { before: t1.balanceBefore, after: t1.balanceAfter, amount: testAmount } });
  }
  const entry1 = await prisma.ledgerEntry.findUniqueOrThrow({ where: { id: t1.ledgerEntryId } });
  checks.push({
    id: "ledger_type_and_ref",
    pass:
      entry1.entryType === LedgerEntryType.SUPER_ADMIN_TOP_UP &&
      entry1.referenceType === "STORE" &&
      entry1.referenceId === ourStore.id &&
      isMetadataSource(entry1) &&
      entry1.createdByUserId === ca.id,
    details: { ledgerEntryId: entry1.id, metadata: entry1.metadata },
  });

  // 2 — idempotent replay: same idempotencyKey
  const t2 = await companyAdminTopUpStoreWallet(storeTopUpActor(ca), {
    storeId: ourStore.id,
    amount: testAmount,
    reason: "replay",
    idempotencyKey: idemClient,
  });
  if (!t2.idempotent) {
    checks.push({ id: "idempotent_replay", pass: false, details: t2 });
  } else {
    checks.push({
      id: "idempotent_replay",
      pass: t1.ledgerEntryId === t2.ledgerEntryId && t1.balanceAfter === t2.balanceAfter,
      details: { duplicateBalanceAfter: t2.balanceAfter, ledgerEntryId: t2.ledgerEntryId },
    });
  }

  // 3 — cross-company
  try {
    await companyAdminTopUpStoreWallet(storeTopUpActor(ca), {
      storeId: otherStore.id,
      amount: "0.01",
      reason: "must fail",
      idempotencyKey: `x-${runKey}-1`,
    });
    checks.push({ id: "cross_company_denied", pass: false });
  } catch (e) {
    assertCode(e, "FORBIDDEN");
    checks.push({ id: "cross_company_denied", pass: true });
  }

  // 4 — no companyId
  try {
    await companyAdminTopUpStoreWallet(
      { userId: ca.id, role: "COMPANY_ADMIN" as AppRole, companyId: null, branchId: null },
      {
        storeId: ourStore.id,
        amount: "0.01",
        reason: "must fail",
        idempotencyKey: `x-${runKey}-2`,
      },
    );
    checks.push({ id: "no_company_tenant", pass: false });
  } catch (e) {
    assertCode(e, "TENANT_SCOPE_REQUIRED");
    checks.push({ id: "no_company_tenant", pass: true });
  }

  // 5 — company wallet top-up still forbidden for company admin
  try {
    await companyWalletService.superAdminTopUpCompanyWallet(companyActor(ca), {
      companyId: ca.companyId,
      amount: "0.01",
      idempotencyKey: `x-${runKey}-co`,
      reason: "must fail",
    });
    checks.push({ id: "ca_cannot_topup_company_wallet", pass: false });
  } catch (e) {
    assertCode(e, "FORBIDDEN");
    checks.push({ id: "ca_cannot_topup_company_wallet", pass: true });
  }

  // 6 — Super Admin store top-up service still works (separate idempotency namespace)
  const saRes = await superAdminWalletTopupService.topUpStoreWallet({
    storeId: ourStore.id,
    amount: "0.01",
    idempotencyKey: `p261-sa-smoke-${runKey}`,
    createdByUserId: sa.id,
  });
  checks.push({
    id: "super_admin_store_topup_smoke",
    pass: saRes.walletAccountId === t1.walletAccountId,
    details: { ledgerEntryId: saRes.ledgerEntryId, newBalance: saRes.newBalanceCached, idempotent: saRes.idempotent },
  });

  // 7 — super-admin-wallets route file: store top-up, super only
  const rPath = path.join(apiRoot, "src/routes/v1/super-admin-wallets.routes.ts");
  const rSrc = await readFile(rPath, "utf8");
  const saStoreTopUp =
    rSrc.includes("requireRoles(...ROLE_GROUPS.superAdmins)") &&
    rSrc.includes("/stores/:storeId/top-up") &&
    rSrc.includes("topUpStore");
  checks.push({
    id: "super_admin_route_file_unchanged_pattern",
    pass: saStoreTopUp,
    details: { file: "super-admin-wallets.routes.ts" },
  });

  // 8 — new finance route present
  const wrPath = path.join(apiRoot, "src/routes/v1/wallet-read.routes.ts");
  const wrSrc = await readFile(wrPath, "utf8");
  checks.push({
    id: "company_top_up_route_registered",
    pass:
      wrSrc.includes("company-top-up") &&
      wrSrc.includes("COMPANY_ADMIN") &&
      wrSrc.includes("CompanyAdminStoreTopUpBodySchema"),
    details: {},
  });

  // 9 — wallet type counts: STORE / CAPTAIN / SUPERVISOR / COMPANY should match before; we added 2 small ledger lines on one store, no new accounts expected
  const afterCounts = await countWalletsByOwner();
  const watch2: WalletOwnerType[] = [
    WalletOwnerType.STORE,
    WalletOwnerType.CAPTAIN,
    WalletOwnerType.SUPERVISOR_USER,
    WalletOwnerType.COMPANY,
  ];
  let okCounts = true;
  for (const ot of watch2) {
    if ((beforeCounts[ot] ?? 0) !== (afterCounts[ot] ?? 0)) {
      okCounts = false;
    }
  }
  checks.push({
    id: "wallet_type_counts_stable",
    pass: okCounts,
    details: { before: beforeCounts, after: afterCounts, watch: watch2 },
  });

  const saOnly = ROLE_GROUPS.superAdmins.length === 1 && ROLE_GROUPS.superAdmins[0] === "SUPER_ADMIN";
  checks.push({ id: "role_group_super_admins", pass: saOnly, details: { roles: [...ROLE_GROUPS.superAdmins] } });

  const v = spawnSync("npm run verify:phase0:tenant-negative", { cwd: apiRoot, shell: true, encoding: "utf8" });
  checks.push({ id: "verify_phase0", pass: v.status === 0, details: { exitCode: v.status, stderrTail: v.stderr?.slice(-400) } });

  const failed = checks.filter((c) => !c.pass);
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        phase: "2.6.1",
        endpoint: "POST /api/v1/finance/stores/:storeId/company-top-up",
        testAmount: { ILS: testAmount, storeId: ourStore.id, idempotencyKey: idemClient },
        saSmoke: { ourStoreId: ourStore.id, saLedger: saRes.ledgerEntryId },
        totalChecks: checks.length,
        failedChecks: failed.length,
        checks,
        note: "Compensate small test debits in QA if required; do not delete ledger entries.",
      },
      null,
      2,
    ),
  );
  if (failed.length) {
    process.exit(1);
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
