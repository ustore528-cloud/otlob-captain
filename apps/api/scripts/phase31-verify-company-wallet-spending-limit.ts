/**
 * Phase 3.1 — Company wallet balance enforcement for Company Admin store/captain top-ups.
 * Run: `npm run phase31:verify-company-wallet-spending-limit` from `apps/api`
 *
 * **Legacy / store fixture:** requires an aligned STORE `WalletAccount` for the company (same currency as company wallet).
 * For the **Storeless Company Admin** gate (no store wallet in DB), use:
 *   `npm run phaseS41:verify-storeless-company-finance -w @captain/api`
 *
 * If `STORELESS_COMPANY_ADMIN=1`, this script exits 0 immediately so CI can skip store-dependent checks.
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
} from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";
import {
  buildCompanyAdminStoreTopUpTransferBase,
  companyAdminTopUpStoreWallet,
} from "../src/services/company-admin-wallet-topup.service.js";
import { companyWalletService, type CompanyWalletActor } from "../src/services/company-wallet.service.js";
import {
  buildCompanyAdminCaptainCoDebitIdempotencyKey,
  captainPrepaidBalanceService,
} from "../src/services/captain-prepaid-balance.service.js";
import { superAdminWalletTopupService } from "../src/services/super-admin-wallet-topup.service.js";
import { financePrepaidChargeClientIdempotencyKey, LEDGER_REF_CAPTAIN_PREPAID_OP } from "../src/config/captain-prepaid-ledger.js";
import { AppError } from "../src/utils/errors.js";
import { money } from "../src/services/ledger/money.js";
import { TRANSFER_FROM_KEY_SUFFIX, TRANSFER_TO_KEY_SUFFIX } from "../src/services/ledger/transfer.js";
import type { AppRole } from "../src/lib/rbac-roles.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "..");

type Check = { id: string; pass: boolean; details?: unknown };

function assertCode(e: unknown, code: string): void {
  if (!(e instanceof AppError) || e.code !== code) {
    throw e instanceof Error ? e : new Error(String(e));
  }
}

function companyActor(u: {
  id: string;
  role: UserRole;
  companyId: string | null;
  branchId: string | null;
}): CompanyWalletActor {
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

async function main() {
  if (process.env.STORELESS_COMPANY_ADMIN === "1") {
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          phase: "3.1",
          skipped: true,
          reason: "STORELESS_COMPANY_ADMIN=1 — use phaseS41:verify-storeless-company-finance for storeless gate; phase31 needs STORE wallet alignment.",
        },
        null,
        2,
      ),
    );
    return;
  }

  const checks: Check[] = [];
  const runKey = `p31-${Date.now()}`;

  const sa = await prisma.user.findFirst({ where: { isActive: true, role: UserRole.SUPER_ADMIN } });
  if (!sa) throw new Error("No active SUPER_ADMIN");
  const ca = await prisma.user.findFirst({
    where: { isActive: true, role: UserRole.COMPANY_ADMIN, companyId: { not: null } },
  });
  if (!ca?.companyId) throw new Error("No COMPANY_ADMIN with companyId");
  const otherCo = await prisma.company.findFirst({ where: { isActive: true, id: { not: ca.companyId } } });
  if (!otherCo) throw new Error("Second company required");

  const coWalletRow = await prisma.walletAccount.findFirst({
    where: { ownerType: WalletOwnerType.COMPANY, ownerId: ca.companyId },
  });
  if (!coWalletRow) throw new Error("No company wallet row for CA company");
  const storeW = await prisma.walletAccount.findFirst({
    where: { ownerType: WalletOwnerType.STORE, companyId: ca.companyId, currency: coWalletRow.currency },
  });
  if (!storeW) {
    throw new Error(`No STORE wallet for company ${ca.companyId} with currency ${coWalletRow.currency} (align with company wallet)`);
  }
  const ourStore = await prisma.store.findUniqueOrThrow({ where: { id: storeW.ownerId } });
  const otherStore = await prisma.store.findFirst({ where: { companyId: otherCo.id, isActive: true } });
  if (!otherStore) throw new Error("No other company store");
  const ourCaptain = await prisma.captain.findFirst({ where: { companyId: ca.companyId, isActive: true } });
  if (!ourCaptain) throw new Error("No captain in CA company");
  const otherCaptain = await prisma.captain.findFirst({ where: { companyId: otherCo.id, isActive: true } });
  if (!otherCaptain) throw new Error("No other company captain");

  const floatProbe = (await companyWalletService.getCompanyWalletBalance(companyActor(sa), ca.companyId!))
    .balanceCached;
  if (money(floatProbe).lt(money("5.00"))) {
    await companyWalletService.superAdminTopUpCompanyWallet(companyActor(sa), {
      companyId: ca.companyId!,
      amount: "20.00",
      idempotencyKey: `p31-prefloat-${runKey}`,
      reason: "phase31 prefloat",
    });
  }

  // —— 1–6 Store: success, exact debit/credit, replay, insufficient, no side effects on fail ——
  const storeAmt = "0.04";
  const storeIdem = `p31-store-${runKey}`;
  const coBefore1 = (await companyWalletService.getCompanyWalletBalance(companyActor(ca), ca.companyId!))
    .balanceCached;
  const s1 = await companyAdminTopUpStoreWallet(prepaidActor(ca), {
    storeId: ourStore.id,
    amount: storeAmt,
    reason: "phase31 store",
    idempotencyKey: storeIdem,
  });
  const coAfter1 = (await companyWalletService.getCompanyWalletBalance(companyActor(ca), ca.companyId!))
    .balanceCached;
  const storeBase = buildCompanyAdminStoreTopUpTransferBase(ca.companyId, ourStore.id, storeIdem);
  const fromK = storeBase + TRANSFER_FROM_KEY_SUFFIX;
  const toK = storeBase + TRANSFER_TO_KEY_SUFFIX;
  const leFrom = await prisma.ledgerEntry.findUniqueOrThrow({ where: { idempotencyKey: fromK } });
  const leTo = await prisma.ledgerEntry.findUniqueOrThrow({ where: { idempotencyKey: toK } });
  checks.push({ id: "1_ca_store_succeeds", pass: !s1.idempotent, details: { storeLedgerEntryId: s1.ledgerEntryId } });
  checks.push({
    id: "2_3_company_debit_and_store_credit_exact",
    pass:
      money(coBefore1).minus(money(coAfter1)).equals(money(storeAmt)) &&
      money(leFrom.amount).equals(money(storeAmt).negated()) &&
      money(leTo.amount).equals(money(storeAmt)),
    details: { from: leFrom.id, to: leTo.id },
  });
  const s1Replay = await companyAdminTopUpStoreWallet(prepaidActor(ca), {
    storeId: ourStore.id,
    amount: storeAmt,
    reason: "replay",
    idempotencyKey: storeIdem,
  });
  const coAfterReplay = (await companyWalletService.getCompanyWalletBalance(companyActor(ca), ca.companyId!))
    .balanceCached;
  const dupFrom = await prisma.ledgerEntry.count({ where: { idempotencyKey: fromK } });
  const dupTo = await prisma.ledgerEntry.count({ where: { idempotencyKey: toK } });
  checks.push({
    id: "4_5_replay_no_double_ledger",
    pass: s1Replay.idempotent && coAfter1 === coAfterReplay && dupFrom === 1 && dupTo === 1,
    details: { replay: s1Replay.idempotent },
  });
  const coBal = money((await companyWalletService.getCompanyWalletBalance(companyActor(ca), ca.companyId!)).balanceCached);
  const tooMuch = coBal.plus(0.01).toFixed(2);
  let threwInsStore = false;
  try {
    await companyAdminTopUpStoreWallet(prepaidActor(ca), {
      storeId: ourStore.id,
      amount: tooMuch,
      reason: "should fail",
      idempotencyKey: `p31-badstore-${runKey}`,
    });
  } catch (e) {
    if (e instanceof AppError && e.code === "INSUFFICIENT_COMPANY_BALANCE") threwInsStore = true;
  }
  const coAfterFail = (await companyWalletService.getCompanyWalletBalance(companyActor(ca), ca.companyId!))
    .balanceCached;
  const badStoreBase = buildCompanyAdminStoreTopUpTransferBase(ca.companyId, ourStore.id, `p31-badstore-${runKey}`);
  const badFrom = await prisma.ledgerEntry.count({ where: { idempotencyKey: badStoreBase + TRANSFER_FROM_KEY_SUFFIX } });
  const badTo = await prisma.ledgerEntry.count({ where: { idempotencyKey: badStoreBase + TRANSFER_TO_KEY_SUFFIX } });
  checks.push({
    id: "6_insufficient_store_409_and_no_ledger",
    pass: threwInsStore && coAfterFail === coAfterReplay && badFrom === 0 && badTo === 0,
    details: { tooMuch },
  });

  // —— 7–12 Captain: success, amounts, CBT, replay, insufficient ——
  const capAmt = "0.03";
  const capIdem = `p31-cap-${runKey}`;
  const wantCapKey = financePrepaidChargeClientIdempotencyKey("company_admin", ourCaptain.id, capIdem);
  const coBeforeCap = (await companyWalletService.getCompanyWalletBalance(companyActor(ca), ca.companyId!))
    .balanceCached;
  const c1 = await captainPrepaidBalanceService.chargeCaptainWithClientIdempotency({
    actor: prepaidActor(ca),
    captainId: ourCaptain.id,
    amount: capAmt,
    reason: "phase31 cap",
    idempotencyKey: capIdem,
  });
  const coDebitsK = buildCompanyAdminCaptainCoDebitIdempotencyKey(ca.companyId, ourCaptain.id, capIdem);
  const leCoCap = await prisma.ledgerEntry.findUniqueOrThrow({ where: { idempotencyKey: coDebitsK } });
  const leCap = await prisma.ledgerEntry.findUniqueOrThrow({ where: { id: c1.ledgerEntryId } });
  const cbtCount = await prisma.captainBalanceTransaction.count({
    where: { captainId: ourCaptain.id, prepaidLedgerOperationId: wantCapKey, type: CaptainBalanceTransactionType.CHARGE },
  });
  const coAfterCap = (await companyWalletService.getCompanyWalletBalance(companyActor(ca), ca.companyId!))
    .balanceCached;
  checks.push({
    id: "7_8_9_captain_success_debit_credit_cbt",
    pass:
      !c1.idempotent &&
      cbtCount === 1 &&
      money(coBeforeCap).minus(money(coAfterCap)).equals(money(capAmt)) &&
      money(leCoCap.amount).equals(money(capAmt).negated()) &&
      leCoCap.entryType === LedgerEntryType.WALLET_TRANSFER &&
      leCap.entryType === LedgerEntryType.CAPTAIN_PREPAID_CHARGE,
    details: { coDebit: leCoCap.id, capLedger: leCap.id },
  });
  const c2 = await captainPrepaidBalanceService.chargeCaptainWithClientIdempotency({
    actor: prepaidActor(ca),
    captainId: ourCaptain.id,
    amount: capAmt,
    reason: "replay",
    idempotencyKey: capIdem,
  });
  const coAfterCap2 = (await companyWalletService.getCompanyWalletBalance(companyActor(ca), ca.companyId!))
    .balanceCached;
  const cbtCount2 = await prisma.captainBalanceTransaction.count({
    where: { captainId: ourCaptain.id, prepaidLedgerOperationId: wantCapKey, type: CaptainBalanceTransactionType.CHARGE },
  });
  const dupCoCap = await prisma.ledgerEntry.count({ where: { idempotencyKey: coDebitsK } });
  checks.push({
    id: "10_11_captain_replay",
    pass: c2.idempotent && coAfterCap === coAfterCap2 && cbtCount2 === 1 && dupCoCap === 1,
    details: {},
  });
  const coBal2 = money((await companyWalletService.getCompanyWalletBalance(companyActor(ca), ca.companyId!)).balanceCached);
  const capToo = coBal2.plus(0.01).toFixed(2);
  let threwInsCap = false;
  try {
    await captainPrepaidBalanceService.chargeCaptainWithClientIdempotency({
      actor: prepaidActor(ca),
      captainId: ourCaptain.id,
      amount: capToo,
      reason: "x",
      idempotencyKey: `p31-badcap-${runKey}`,
    });
  } catch (e) {
    if (e instanceof AppError && e.code === "INSUFFICIENT_COMPANY_BALANCE") threwInsCap = true;
  }
  const coAfterCapFail = (await companyWalletService.getCompanyWalletBalance(companyActor(ca), ca.companyId!))
    .balanceCached;
  const badCapId = `p31-badcap-${runKey}`;
  const badCapLeg = financePrepaidChargeClientIdempotencyKey("company_admin", ourCaptain.id, badCapId);
  const badCoDebits = buildCompanyAdminCaptainCoDebitIdempotencyKey(ca.companyId, ourCaptain.id, badCapId);
  const noCapLed = (await prisma.ledgerEntry.count({ where: { idempotencyKey: badCapLeg } })) === 0;
  const noCoDebits = (await prisma.ledgerEntry.count({ where: { idempotencyKey: badCoDebits } })) === 0;
  const noExtraCbt = (await prisma.captainBalanceTransaction.count({ where: { prepaidLedgerOperationId: badCapLeg } })) === 0;
  checks.push({
    id: "12_insufficient_captain",
    pass: threwInsCap && coAfterCapFail === coAfterCap2 && noCapLed && noCoDebits && noExtraCbt,
    details: {},
  });

  // —— 13–15 ——
  try {
    await companyAdminTopUpStoreWallet(prepaidActor(ca), { storeId: otherStore.id, amount: "0.01", reason: "x", idempotencyKey: `p31-x1-${runKey}` });
    checks.push({ id: "13_cross_store_403", pass: false });
  } catch (e) {
    assertCode(e, "FORBIDDEN");
    checks.push({ id: "13_cross_store_403", pass: true });
  }
  try {
    await companyAdminTopUpStoreWallet(
      { userId: ca.id, role: "COMPANY_ADMIN" as AppRole, companyId: null, branchId: null },
      { storeId: ourStore.id, amount: "0.01", reason: "x", idempotencyKey: `p31-x2-${runKey}` },
    );
    checks.push({ id: "14_tenant_scope", pass: false });
  } catch (e) {
    assertCode(e, "TENANT_SCOPE_REQUIRED");
    checks.push({ id: "14_tenant_scope", pass: true });
  }
  try {
    await companyWalletService.superAdminTopUpCompanyWallet(companyActor(ca), {
      companyId: ca.companyId!,
      amount: "0.01",
      idempotencyKey: `p31-caw-${runKey}`,
      reason: "nope",
    });
    checks.push({ id: "15_ca_cannot_topup_company", pass: false });
  } catch (e) {
    assertCode(e, "FORBIDDEN");
    checks.push({ id: "15_ca_cannot_topup_company", pass: true });
  }

  // —— 16 Super Admin behavior ——
  const saTop = await companyWalletService.superAdminTopUpCompanyWallet(companyActor(sa), {
    companyId: ca.companyId!,
    amount: "0.02",
    idempotencyKey: `p31-sa-co-${runKey}`,
    reason: "phase31 SA",
  });
  const saSt = await superAdminWalletTopupService.topUpStoreWallet({
    storeId: ourStore.id,
    amount: "0.01",
    idempotencyKey: `p31-sa-st-${runKey}`,
    createdByUserId: sa.id,
  });
  const saCap = await captainPrepaidBalanceService.chargeCaptainWithClientIdempotency({
    actor: prepaidActor(sa),
    captainId: ourCaptain.id,
    amount: "0.01",
    reason: "SA cap",
    idempotencyKey: `p31-sa-cap-${runKey}`,
  });
  const leSaCap = await prisma.ledgerEntry.findUniqueOrThrow({ where: { id: saCap.ledgerEntryId } });
  checks.push({
    id: "16_super_admin_paths_unchanged",
    pass: Boolean(saTop.ledgerEntryId) && Boolean(saSt.ledgerEntryId) && leSaCap.metadata !== null,
    details: { saTop: saTop.ledgerEntryId },
  });

  const v = spawnSync("npm run verify:phase0:tenant-negative", { cwd: apiRoot, shell: true, encoding: "utf8" });
  checks.push({ id: "17_verify_phase0", pass: v.status === 0, details: { exitCode: v.status } });

  const failed = checks.filter((c) => !c.pass);
  const summary = {
    generatedAt: new Date().toISOString(),
    phase: "3.1",
    phasePass: failed.length === 0,
    totalChecks: checks.length,
    failedChecks: failed.length,
    checks,
    errorCodeInsufficient: "INSUFFICIENT_COMPANY_BALANCE",
  };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(summary, null, 2));
  if (failed.length > 0) process.exit(1);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
