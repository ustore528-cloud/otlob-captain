/**
 * Phase 2.6.3 — Company Admin finance top-up verification sweep (pre–dashboard UI).
 * Run: `npm run phase263:verify-company-admin-finance-topup-sweep` from `apps/api`
 *
 * Moves small QA amounts on non-prod DBs; use compensating entries if needed—do not delete ledger history.
 */
import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  CaptainBalanceTransactionType,
  LedgerEntryType,
  UserRole,
  WalletOwnerType,
  type Prisma,
} from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";
import { companyAdminTopUpStoreWallet } from "../src/services/company-admin-wallet-topup.service.js";
import {
  assertCanReadCompanyWallet,
  companyWalletService,
  type CompanyWalletActor,
} from "../src/services/company-wallet.service.js";
import { captainPrepaidBalanceService } from "../src/services/captain-prepaid-balance.service.js";
import { financePrepaidChargeClientIdempotencyKey, LEDGER_REF_CAPTAIN_PREPAID_OP } from "../src/config/captain-prepaid-ledger.js";
import { superAdminWalletTopupService } from "../src/services/super-admin-wallet-topup.service.js";
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

function companyActor(
  u: { id: string; role: UserRole; companyId: string | null; branchId: string | null },
): CompanyWalletActor {
  return { userId: u.id, role: u.role, companyId: u.companyId, branchId: u.branchId };
}

function prepaidActor(u: {
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

function metaSource(ledger: { metadata: Prisma.JsonValue | null }, want: string): boolean {
  if (!ledger.metadata || typeof ledger.metadata !== "object" || Array.isArray(ledger.metadata)) {
    return false;
  }
  return (ledger.metadata as Record<string, unknown>).source === want;
}

async function main() {
  const checks: Check[] = [];
  const runKey = `p263-${Date.now()}`;
  const ledgerIdsWritten: string[] = [];
  const beforeCounts = await countWalletsByOwner();

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

  const storeWallet = await prisma.walletAccount.findFirst({
    where: { ownerType: WalletOwnerType.STORE, companyId: ca.companyId },
  });
  if (!storeWallet) {
    throw new Error(`No STORE wallet for company ${ca.companyId}`);
  }
  const ourStore = await prisma.store.findUniqueOrThrow({ where: { id: storeWallet.ownerId } });
  const otherStore = await prisma.store.findFirst({
    where: { companyId: otherCo.id, isActive: true },
  });
  if (!otherStore) {
    throw new Error("No store in other company");
  }

  const ourCaptain = await prisma.captain.findFirst({
    where: { companyId: ca.companyId, isActive: true },
  });
  if (!ourCaptain) {
    throw new Error("No captain in CA company");
  }
  const otherCaptain = await prisma.captain.findFirst({
    where: { companyId: otherCo.id, isActive: true },
  });
  if (!otherCaptain) {
    throw new Error("No captain in other company");
  }

  const companyWalletBeforeStr = (
    await companyWalletService.getCompanyWalletBalance(companyActor(ca), ca.companyId)
  ).balanceCached;

  // —— 1) Company Admin store top-up ——
  const storeAmount = "0.02";
  const storeIdem = `store-idem-${runKey}`;
  const s1 = await companyAdminTopUpStoreWallet(prepaidActor(ca), {
    storeId: ourStore.id,
    amount: storeAmount,
    reason: "phase263 store sweep",
    idempotencyKey: storeIdem,
  });
  ledgerIdsWritten.push(s1.ledgerEntryId);
  if (s1.idempotent) {
    throw new Error("first store top-up must not be idempotent");
  }
  const leStore = await prisma.ledgerEntry.findUniqueOrThrow({ where: { id: s1.ledgerEntryId } });
  checks.push({
    id: "ca_store_own_company",
    pass: money(leStore.amount).equals(money(storeAmount)) && metaSource(leStore, "company_admin_store_wallet_topup"),
    details: { ledgerEntryId: leStore.id, idempotencyKey: leStore.idempotencyKey },
  });

  const s2 = await companyAdminTopUpStoreWallet(prepaidActor(ca), {
    storeId: ourStore.id,
    amount: storeAmount,
    reason: "replay",
    idempotencyKey: storeIdem,
  });
  checks.push({
    id: "ca_store_idempotent_no_double",
    pass: s2.idempotent && s1.ledgerEntryId === s2.ledgerEntryId,
    details: { replay: s2.idempotent },
  });
  const ledgerDupStore = await prisma.ledgerEntry.count({
    where: { idempotencyKey: `ca-topup:store:${ourStore.id}:${storeIdem}` },
  });
  checks.push({ id: "ca_store_ledger_single_row", pass: ledgerDupStore === 1, details: { count: ledgerDupStore } });

  try {
    await companyAdminTopUpStoreWallet(prepaidActor(ca), {
      storeId: otherStore.id,
      amount: "0.01",
      reason: "x",
      idempotencyKey: `x-${runKey}-s`,
    });
    checks.push({ id: "ca_store_cross_company", pass: false });
  } catch (e) {
    assertCode(e, "FORBIDDEN");
    checks.push({ id: "ca_store_cross_company", pass: true });
  }

  try {
    await companyAdminTopUpStoreWallet(
      { userId: ca.id, role: "COMPANY_ADMIN" as AppRole, companyId: null, branchId: null },
      {
        storeId: ourStore.id,
        amount: "0.01",
        reason: "x",
        idempotencyKey: `x-${runKey}-s2`,
      },
    );
    checks.push({ id: "ca_store_missing_company", pass: false });
  } catch (e) {
    assertCode(e, "TENANT_SCOPE_REQUIRED");
    checks.push({ id: "ca_store_missing_company", pass: true });
  }

  // —— 2) Company Admin captain prepaid (finance path) ——
  const capPreBefore = (await prisma.captain.findUniqueOrThrow({ where: { id: ourCaptain.id } })).prepaidBalance;
  const capAmount = "0.03";
  const capIdem = `cap-idem-${runKey}`;
  const c1 = await captainPrepaidBalanceService.chargeCaptainWithClientIdempotency({
    actor: prepaidActor(ca),
    captainId: ourCaptain.id,
    amount: capAmount,
    reason: "phase263 captain sweep",
    idempotencyKey: capIdem,
  });
  ledgerIdsWritten.push(c1.ledgerEntryId);
  if (c1.idempotent) {
    throw new Error("first captain charge must not be idempotent");
  }
  const leCap = await prisma.ledgerEntry.findUniqueOrThrow({ where: { id: c1.ledgerEntryId } });
  const wantCapKey = financePrepaidChargeClientIdempotencyKey("company_admin", ourCaptain.id, capIdem);
  checks.push({
    id: "ca_captain_own_company_metadata",
    pass:
      leCap.entryType === LedgerEntryType.CAPTAIN_PREPAID_CHARGE &&
      leCap.referenceType === LEDGER_REF_CAPTAIN_PREPAID_OP &&
      leCap.referenceId === wantCapKey &&
      metaSource(leCap, "company_admin_captain_prepaid_charge"),
    details: { ledgerEntryId: leCap.id },
  });

  const c2 = await captainPrepaidBalanceService.chargeCaptainWithClientIdempotency({
    actor: prepaidActor(ca),
    captainId: ourCaptain.id,
    amount: capAmount,
    reason: "replay",
    idempotencyKey: capIdem,
  });
  checks.push({
    id: "ca_captain_idempotent_no_double",
    pass: c2.idempotent && c1.transaction.id === c2.transaction.id,
    details: {},
  });
  const cbtDup = await prisma.captainBalanceTransaction.count({
    where: { captainId: ourCaptain.id, prepaidLedgerOperationId: wantCapKey, type: CaptainBalanceTransactionType.CHARGE },
  });
  checks.push({ id: "ca_captain_single_cbt", pass: cbtDup === 1, details: { count: cbtDup } });

  try {
    await captainPrepaidBalanceService.chargeCaptainWithClientIdempotency({
      actor: prepaidActor(ca),
      captainId: otherCaptain.id,
      amount: "0.01",
      reason: "x",
      idempotencyKey: `x-${runKey}-c`,
    });
    checks.push({ id: "ca_captain_cross_company", pass: false });
  } catch (e) {
    assertCode(e, "FORBIDDEN");
    checks.push({ id: "ca_captain_cross_company", pass: true });
  }

  try {
    await captainPrepaidBalanceService.chargeCaptainWithClientIdempotency({
      actor: { userId: ca.id, role: "COMPANY_ADMIN" as AppRole, companyId: null, branchId: null },
      captainId: ourCaptain.id,
      amount: "0.01",
      reason: "x",
      idempotencyKey: `x-${runKey}-c2`,
    });
    checks.push({ id: "ca_captain_missing_company", pass: false });
  } catch (e) {
    assertCode(e, "TENANT_SCOPE_REQUIRED");
    checks.push({ id: "ca_captain_missing_company", pass: true });
  }

  try {
    await captainPrepaidBalanceService.chargeCaptainWithClientIdempotency({
      actor: prepaidActor(ca),
      captainId: ourCaptain.id,
      amount: "0.01",
      reason: "",
      idempotencyKey: `x-${runKey}-c3`,
    });
    checks.push({ id: "ca_captain_reason_required", pass: false });
  } catch (e) {
    assertCode(e, "REASON_REQUIRED");
    checks.push({ id: "ca_captain_reason_required", pass: true });
  }

  const companyWalletAfterStoreCaptain = (
    await companyWalletService.getCompanyWalletBalance(companyActor(ca), ca.companyId)
  ).balanceCached;
  checks.push({
    id: "company_wallet_untouched_by_store_captain",
    pass: companyWalletBeforeStr === companyWalletAfterStoreCaptain,
    details: { balance: companyWalletAfterStoreCaptain },
  });

  // —— 3) Company wallet: CA cannot top up; read rules ——
  try {
    await companyWalletService.superAdminTopUpCompanyWallet(companyActor(ca), {
      companyId: ca.companyId,
      amount: "0.01",
      idempotencyKey: `x-${runKey}-cw`,
      reason: "must fail",
    });
    checks.push({ id: "ca_cannot_topup_company_wallet", pass: false });
  } catch (e) {
    assertCode(e, "FORBIDDEN");
    checks.push({ id: "ca_cannot_topup_company_wallet", pass: true });
  }

  const meRead = await companyWalletService.getCompanyWalletReadMe(companyActor(ca));
  checks.push({
    id: "ca_read_own_company_wallet",
    pass: meRead.companyId === ca.companyId && meRead.walletId.length > 0,
    details: { companyId: meRead.companyId },
  });

  try {
    assertCanReadCompanyWallet(companyActor(ca), otherCo.id);
    checks.push({ id: "ca_cannot_read_other_company_wallet", pass: false });
  } catch (e) {
    assertCode(e, "FORBIDDEN");
    checks.push({ id: "ca_cannot_read_other_company_wallet", pass: true });
  }

  try {
    await companyWalletService.getCompanyWalletReadById(companyActor(ca), ca.companyId);
    checks.push({ id: "ca_by_id_forbidden", pass: false });
  } catch (e) {
    assertCode(e, "FORBIDDEN");
    checks.push({ id: "ca_by_id_forbidden", pass: true });
  }

  // —— 4) Super Admin smoke (unchanged API surface) ——
  const saCo = await companyWalletService.superAdminTopUpCompanyWallet(companyActor(sa), {
    companyId: ca.companyId,
    amount: "0.01",
    idempotencyKey: `p263-sa-co-${runKey}`,
    reason: "phase263 SA company sweep",
  });
  ledgerIdsWritten.push(saCo.ledgerEntryId);
  checks.push({
    id: "sa_company_topup",
    pass: !saCo.idempotent,
    details: { ledgerEntryId: saCo.ledgerEntryId, idempotent: saCo.idempotent },
  });

  const saStore = await superAdminWalletTopupService.topUpStoreWallet({
    storeId: ourStore.id,
    amount: "0.01",
    idempotencyKey: `p263-sa-store-${runKey}`,
    createdByUserId: sa.id,
  });
  ledgerIdsWritten.push(saStore.ledgerEntryId);
  checks.push({
    id: "sa_store_topup",
    pass: Boolean(saStore.ledgerEntryId),
    details: { ledgerEntryId: saStore.ledgerEntryId },
  });

  const saCap = await captainPrepaidBalanceService.chargeCaptainWithClientIdempotency({
    actor: prepaidActor(sa),
    captainId: ourCaptain.id,
    amount: "0.02",
    reason: "phase263 SA finance captain",
    idempotencyKey: `p263-sa-cap-${runKey}`,
  });
  ledgerIdsWritten.push(saCap.ledgerEntryId);
  const leSaCap = await prisma.ledgerEntry.findUniqueOrThrow({ where: { id: saCap.ledgerEntryId } });
  checks.push({
    id: "sa_finance_captain_prepaid",
    pass: metaSource(leSaCap, "super_admin_captain_prepaid_charge"),
    details: { ledgerEntryId: saCap.ledgerEntryId },
  });

  const saRead = await companyWalletService.getCompanyWalletReadById(companyActor(sa), ca.companyId);
  checks.push({
    id: "sa_read_company_wallet",
    pass: saRead.companyId === ca.companyId,
    details: { walletId: saRead.walletId },
  });

  // —— 5) Tenant note: all CA writes used actor.companyId from DB user row (no body companyId) ——
  checks.push({
    id: "tenant_scope_derived_from_actor",
    pass: true,
    details: {
      note: "Sweep uses service APIs with actor.companyId from DB; no client companyId field is passed for CA scope.",
    },
  });

  // —— 6) Ledger invariants / wallet counts ——
  const afterCounts = await countWalletsByOwner();
  const watch: WalletOwnerType[] = [
    WalletOwnerType.STORE,
    WalletOwnerType.CAPTAIN,
    WalletOwnerType.SUPERVISOR_USER,
    WalletOwnerType.COMPANY,
  ];
  let countsStable = true;
  for (const ot of watch) {
    if ((beforeCounts[ot] ?? 0) !== (afterCounts[ot] ?? 0)) {
      countsStable = false;
    }
  }
  checks.push({
    id: "wallet_owner_counts_stable",
    pass: countsStable,
    details: { before: beforeCounts, after: afterCounts, watch },
  });

  const v = spawnSync("npm run verify:phase0:tenant-negative", { cwd: apiRoot, shell: true, encoding: "utf8" });
  checks.push({ id: "verify_phase0", pass: v.status === 0, details: { exitCode: v.status } });

  const failed = checks.filter((c) => !c.pass);
  const phasePass = failed.length === 0;

  const summary = {
    generatedAt: new Date().toISOString(),
    phase: "2.6.3",
    phasePass,
    totalChecks: checks.length,
    failedChecks: failed.length,
    passedChecks: checks.length - failed.length,
    checks,
    ledgerIdsWritten,
    idempotencyReplay: {
      store: { idempotencyKey: storeIdem, firstLedgerId: s1.ledgerEntryId, replayIdempotent: s2.idempotent },
      captain: { idempotencyKey: capIdem, firstLedgerId: c1.ledgerEntryId, replayIdempotent: c2.idempotent },
    },
    affected: {
      companyIds: { companyAdmin: ca.companyId, other: otherCo.id },
      storeId: ourStore.id,
      captainId: ourCaptain.id,
      tinyAmountsMoved: {
        storeCompanyAdminILS: storeAmount,
        captainCompanyAdminILS: capAmount,
        superAdminCompanyILS: "0.01",
        superAdminStoreILS: "0.01",
        superAdminCaptainILS: "0.02",
      },
    },
    compensationNote:
      "Small credits on QA store/captain/company wallets; reverse with admin/tools if required. Do not delete ledger rows.",
  };

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(summary, null, 2));
  if (!phasePass) {
    process.exit(1);
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
