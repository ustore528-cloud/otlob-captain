/**
 * Phase 2.6.2 — Finance captain prepaid charge (idempotency + reason) verification.
 * Run: `npm run phase262:verify-company-admin-captain-prepaid-idempotency` from `apps/api`
 */
import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { CaptainBalanceTransactionType, LedgerEntryType, UserRole, WalletOwnerType } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";
import { captainPrepaidBalanceService } from "../src/services/captain-prepaid-balance.service.js";
import { financePrepaidChargeClientIdempotencyKey, LEDGER_REF_CAPTAIN_PREPAID_OP } from "../src/config/captain-prepaid-ledger.js";
import { AppError } from "../src/utils/errors.js";
import { money } from "../src/services/ledger/money.js";
import type { AppRole } from "../src/lib/rbac-roles.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "..");

type Check = { id: string; pass: boolean; details?: unknown };

function assertCode(e: unknown, code: string): void {
  if (!(e instanceof AppError) || e.code !== code) {
    throw e instanceof Error ? e : new Error(String(e));
  }
}

function actor(
  u: { id: string; role: UserRole; companyId: string | null; branchId: string | null },
): { userId: string; role: AppRole; companyId: string | null; branchId: string | null } {
  return { userId: u.id, role: u.role as AppRole, companyId: u.companyId, branchId: u.branchId };
}

async function main() {
  const checks: Check[] = [];
  const runKey = `p262-qa-${Date.now()}`;

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

  const ourCaptain = await prisma.captain.findFirst({
    where: { companyId: ca.companyId, isActive: true },
  });
  if (!ourCaptain) {
    throw new Error("No active captain in company admin company");
  }
  const otherCaptain = await prisma.captain.findFirst({
    where: { companyId: otherCo.id, isActive: true },
  });
  if (!otherCaptain) {
    throw new Error("No active captain in other company");
  }

  const preBal = ourCaptain.prepaidBalance;
  const testAmount = "0.05";
  const idem = `idem-${runKey}`;

  const t1 = await captainPrepaidBalanceService.chargeCaptainWithClientIdempotency({
    actor: actor(ca),
    captainId: ourCaptain.id,
    amount: testAmount,
    reason: "phase 2.6.2 verify CA prepaid",
    idempotencyKey: idem,
  });
  if (t1.idempotent) {
    throw new Error("first charge must not be idempotent");
  }
  if (!t1.ledgerEntryId) {
    checks.push({ id: "ca_charge_ledger", pass: false });
  } else {
    const le = await prisma.ledgerEntry.findUniqueOrThrow({ where: { id: t1.ledgerEntryId } });
    const meta = le.metadata as { source?: string; reason?: string; actorUserId?: string } | null;
    checks.push({
      id: "ca_charge_ledger",
      pass:
        le.entryType === LedgerEntryType.CAPTAIN_PREPAID_CHARGE &&
        le.referenceType === LEDGER_REF_CAPTAIN_PREPAID_OP &&
        le.referenceId === financePrepaidChargeClientIdempotencyKey("company_admin", ourCaptain.id, idem) &&
        meta?.source === "company_admin_captain_prepaid_charge" &&
        meta?.reason === "phase 2.6.2 verify CA prepaid" &&
        meta?.actorUserId === ca.id,
      details: { ledgerEntryId: le.id, referenceId: le.referenceId },
    });
  }
  const capAfter = await prisma.captain.findUniqueOrThrow({ where: { id: ourCaptain.id } });
  if (!money(capAfter.prepaidBalance).minus(money(preBal)).equals(money(testAmount))) {
    checks.push({ id: "prepaid_delta", pass: false, details: { pre: preBal.toString(), after: capAfter.prepaidBalance.toString() } });
  } else {
    checks.push({ id: "prepaid_delta", pass: true, details: { before: preBal.toString(), after: capAfter.prepaidBalance.toString() } });
  }
  const cbtCountAfterFirst = await prisma.captainBalanceTransaction.count({
    where: { captainId: ourCaptain.id, type: "CHARGE", prepaidLedgerOperationId: t1.transaction.prepaidLedgerOperationId },
  });
  checks.push({ id: "cbt_one_for_op", pass: cbtCountAfterFirst === 1, details: { count: cbtCountAfterFirst } });

  // Idempotent replay
  const t2 = await captainPrepaidBalanceService.chargeCaptainWithClientIdempotency({
    actor: actor(ca),
    captainId: ourCaptain.id,
    amount: testAmount,
    reason: "replay",
    idempotencyKey: idem,
  });
  if (!t2.idempotent) {
    checks.push({ id: "idempotent_replay", pass: false });
  } else {
    const cap2 = await prisma.captain.findUniqueOrThrow({ where: { id: ourCaptain.id } });
    const cbtCountAfterReplay = await prisma.captainBalanceTransaction.count({
      where: { captainId: ourCaptain.id, type: CaptainBalanceTransactionType.CHARGE, prepaidLedgerOperationId: t1.transaction.prepaidLedgerOperationId },
    });
    checks.push({
      id: "idempotent_replay",
      pass:
        t1.transaction.id === t2.transaction.id && money(cap2.prepaidBalance).equals(money(capAfter.prepaidBalance)) && cbtCountAfterReplay === 1,
      details: { balance: cap2.prepaidBalance.toString() },
    });
  }

  // cross-company
  try {
    await captainPrepaidBalanceService.chargeCaptainWithClientIdempotency({
      actor: actor(ca),
      captainId: otherCaptain.id,
      amount: "0.01",
      reason: "must fail",
      idempotencyKey: `x-${runKey}-1`,
    });
    checks.push({ id: "cross_company_denied", pass: false });
  } catch (e) {
    assertCode(e, "FORBIDDEN");
    checks.push({ id: "cross_company_denied", pass: true });
  }

  // no companyId
  try {
    await captainPrepaidBalanceService.chargeCaptainWithClientIdempotency({
      actor: { userId: ca.id, role: "COMPANY_ADMIN" as AppRole, companyId: null, branchId: null },
      captainId: ourCaptain.id,
      amount: "0.01",
      reason: "must fail",
      idempotencyKey: `x-${runKey}-2`,
    });
    checks.push({ id: "no_company_tenant", pass: false });
  } catch (e) {
    assertCode(e, "TENANT_SCOPE_REQUIRED");
    checks.push({ id: "no_company_tenant", pass: true });
  }

  // reason required
  try {
    await captainPrepaidBalanceService.chargeCaptainWithClientIdempotency({
      actor: actor(ca),
      captainId: ourCaptain.id,
      amount: "0.01",
      reason: "   ",
      idempotencyKey: `x-${runKey}-3`,
    });
    checks.push({ id: "reason_required", pass: false });
  } catch (e) {
    assertCode(e, "REASON_REQUIRED");
    checks.push({ id: "reason_required", pass: true });
  }

  // non-positive amount
  try {
    await captainPrepaidBalanceService.chargeCaptainWithClientIdempotency({
      actor: actor(ca),
      captainId: ourCaptain.id,
      amount: 0,
      reason: "must fail",
      idempotencyKey: `x-${runKey}-4`,
    });
    checks.push({ id: "amount_positive", pass: false });
  } catch (e) {
    assertCode(e, "BAD_REQUEST");
    checks.push({ id: "amount_positive", pass: true });
  }

  // legacy Super Admin path still works (separate op id; no idempotency key)
  const legacy1 = await captainPrepaidBalanceService.chargeCaptain(ourCaptain.id, { amount: 0.01, note: "p262 legacy smoke" }, sa.id);
  const legacy2 = await captainPrepaidBalanceService.chargeCaptain(ourCaptain.id, { amount: 0.01, note: "p262 legacy smoke 2" }, sa.id);
  checks.push({
    id: "legacy_charge_distinct_ops",
    pass: legacy1.prepaidLedgerOperationId !== legacy2.prepaidLedgerOperationId,
    details: { id1: legacy1.prepaidLedgerOperationId, id2: legacy2.prepaidLedgerOperationId },
  });

  // Super admin finance path uses admin-topup namespace
  const tSa = await captainPrepaidBalanceService.chargeCaptainWithClientIdempotency({
    actor: actor(sa),
    captainId: ourCaptain.id,
    amount: "0.02",
    reason: "p262 sa finance path",
    idempotencyKey: `sa-${runKey}`,
  });
  const leSa = await prisma.ledgerEntry.findUniqueOrThrow({ where: { id: tSa.ledgerEntryId } });
  const opKeySa = financePrepaidChargeClientIdempotencyKey("super_admin", ourCaptain.id, `sa-${runKey}`);
  const metaSa = leSa.metadata as { source?: string } | null;
  checks.push({
    id: "sa_finance_namespace",
    pass:
      leSa.referenceId === opKeySa &&
      leSa.idempotencyKey === opKeySa &&
      metaSa?.source === "super_admin_captain_prepaid_charge",
    details: { ledgerEntryId: tSa.ledgerEntryId },
  });

  // captain wallet row exists
  const w = await prisma.walletAccount.findUnique({
    where: { ownerType_ownerId: { ownerType: WalletOwnerType.CAPTAIN, ownerId: ourCaptain.id } },
  });
  checks.push({ id: "captain_wallet_exists", pass: Boolean(w), details: { walletId: w?.id } });

  const v = spawnSync("npm run verify:phase0:tenant-negative", { cwd: apiRoot, shell: true, encoding: "utf8" });
  checks.push({ id: "verify_phase0", pass: v.status === 0, details: { exitCode: v.status } });

  const failed = checks.filter((c) => !c.pass);
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        phase: "2.6.2",
        endpoint: "POST /api/v1/finance/captains/:captainId/prepaid-charge",
        testCaptainId: ourCaptain.id,
        totalChecks: checks.length,
        failedChecks: failed.length,
        checks,
        note: "Legacy /captains/:id/prepaid-charge (random op id) remains; small test amounts on QA data.",
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
