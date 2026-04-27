/**
 * Phase S4.1 — Storeless Company Admin finance (no store wallet dependency).
 *
 * Verifies: company wallet read for CA, CA cannot credit company via SA top-up,
 * captain prepaid from company balance, idempotency, INSUFFICIENT_COMPANY_BALANCE, cross-tenant.
 *
 * Prereq: dev DB with SUPER_ADMIN, COMPANY_ADMIN+company, two companies, company wallet, active captain
 *   in the CA’s company.
 * - If the CA’s company has no captain, set `PHASE_S41_BOOTSTRAP=1` once: creates a throwaway captain via
 *   Super Admin in that company (same pattern as other QA scripts).
 * Pre-floats company balance via Super Admin if below threshold.
 *
 * Run: `npm run phaseS41:verify-storeless-company-finance` from repo root (workspace @captain/api).
 */
import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { CaptainBalanceTransactionType, LedgerEntryType, UserRole } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";
import { companyWalletService, type CompanyWalletActor } from "../src/services/company-wallet.service.js";
import { captainsService } from "../src/services/captains.service.js";
import {
  buildCompanyAdminCaptainCoDebitIdempotencyKey,
  captainPrepaidBalanceService,
} from "../src/services/captain-prepaid-balance.service.js";
import { financePrepaidChargeClientIdempotencyKey } from "../src/config/captain-prepaid-ledger.js";
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
  const checks: Check[] = [];
  const runKey = `pS41-${Date.now()}`;

  const sa = await prisma.user.findFirst({ where: { isActive: true, role: UserRole.SUPER_ADMIN } });
  if (!sa) throw new Error("No active SUPER_ADMIN");

  const ca = await prisma.user.findFirst({
    where: {
      role: UserRole.COMPANY_ADMIN,
      isActive: true,
      companyId: { not: null },
      company: { isActive: true, branches: { some: { isActive: true } } },
    },
    orderBy: { createdAt: "asc" },
  });
  if (!ca?.companyId) {
    throw new Error("No active COMPANY_ADMIN whose company has at least one active branch.");
  }

  const otherCo = await prisma.company.findFirst({
    where: {
      isActive: true,
      id: { not: ca.companyId },
      captains: { some: { isActive: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  if (!otherCo) {
    throw new Error("A second company with an active captain is required for the cross-tenant check.");
  }

  await companyWalletService.getOrCreateCompanyWallet(ca.companyId!);

  let ourCaptain = await prisma.captain.findFirst({
    where: { companyId: ca.companyId, isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (!ourCaptain && process.env.PHASE_S41_BOOTSTRAP === "1") {
    const br = await prisma.branch.findFirst({
      where: { companyId: ca.companyId, isActive: true },
      orderBy: { createdAt: "asc" },
    });
    if (!br) {
      throw new Error("PHASE_S41_BOOTSTRAP: no active branch for CA company");
    }
    const phone = `+9725${String(7000000 + (Date.now() % 999999)).padStart(7, "0")}`;
    ourCaptain = await captainsService.create(
      {
        fullName: "Phase S4.1 bootstrap captain",
        phone,
        password: "S41QABootstrap!1",
        vehicleType: "سيارة",
        area: "S41 QA",
        companyId: ca.companyId,
        branchId: br.id,
      },
      sa.id,
    );
  }
  if (!ourCaptain) {
    throw new Error(
      "No active captain in CA company. Seed data or run with PHASE_S41_BOOTSTRAP=1 to create a QA captain.",
    );
  }
  const otherCaptain = await prisma.captain.findFirst({ where: { companyId: otherCo.id, isActive: true } });
  if (!otherCaptain) throw new Error("No active captain in other company");

  // —— 1) CA read own company wallet ——
  const readDto = await companyWalletService.getCompanyWalletBalance(companyActor(ca), ca.companyId!);
  checks.push({
    id: "1_ca_read_company_wallet",
    pass: readDto.companyId === ca.companyId && readDto.walletAccountId.length > 0,
    details: { companyId: readDto.companyId, balance: readDto.balanceCached, currency: readDto.currency },
  });

  // —— 2) CA cannot Super Admin top-up company (no company self-credit) ——
  try {
    await companyWalletService.superAdminTopUpCompanyWallet(companyActor(ca), {
      companyId: ca.companyId!,
      amount: "0.01",
      idempotencyKey: `s41-forbidden-${runKey}`,
      reason: "must be forbidden for CA",
    });
    checks.push({ id: "2_ca_cannot_topup_company_wallet", pass: false });
  } catch (e) {
    assertCode(e, "FORBIDDEN");
    checks.push({ id: "2_ca_cannot_topup_company_wallet", pass: true });
  }

  // —— Pre-float: Super Admin only ——
  const floatProbe = (await companyWalletService.getCompanyWalletBalance(companyActor(sa), ca.companyId!))
    .balanceCached;
  if (money(floatProbe).lt(money("2.00"))) {
    await companyWalletService.superAdminTopUpCompanyWallet(companyActor(sa), {
      companyId: ca.companyId!,
      amount: "15.00",
      idempotencyKey: `s41-prefloat-${runKey}`,
      reason: "phase S4.1 prefloat",
    });
  }

  // —— 3–6) Captain: charge, company debit, captain/prepaid credit, CBT, ledger ——
  const capAmt = "0.04";
  const capIdem = `s41-cap-${runKey}`;
  const preBal = ourCaptain.prepaidBalance;
  const coBeforeCap = (await companyWalletService.getCompanyWalletBalance(companyActor(ca), ca.companyId!))
    .balanceCached;
  const wantCapKey = financePrepaidChargeClientIdempotencyKey("company_admin", ourCaptain.id, capIdem);
  const coDebitsK = buildCompanyAdminCaptainCoDebitIdempotencyKey(ca.companyId, ourCaptain.id, capIdem);

  const c1 = await captainPrepaidBalanceService.chargeCaptainWithClientIdempotency({
    actor: prepaidActor(ca),
    captainId: ourCaptain.id,
    amount: capAmt,
    reason: "phase S4.1 storeless captain",
    idempotencyKey: capIdem,
  });
  const leCoCap = await prisma.ledgerEntry.findUniqueOrThrow({ where: { idempotencyKey: coDebitsK } });
  const leCap = await prisma.ledgerEntry.findUniqueOrThrow({ where: { id: c1.ledgerEntryId! } });
  const coAfterCap = (await companyWalletService.getCompanyWalletBalance(companyActor(ca), ca.companyId!))
    .balanceCached;
  const capAfter = await prisma.captain.findUniqueOrThrow({ where: { id: ourCaptain.id } });
  const cbtCount = await prisma.captainBalanceTransaction.count({
    where: { captainId: ourCaptain.id, prepaidLedgerOperationId: wantCapKey, type: CaptainBalanceTransactionType.CHARGE },
  });
  checks.push({
    id: "3_4_5_captain_charge_debit_and_credit",
    pass:
      !c1.idempotent &&
      cbtCount === 1 &&
      money(coBeforeCap).minus(money(coAfterCap)).equals(money(capAmt)) &&
      money(leCoCap.amount).equals(money(capAmt).negated()) &&
      leCoCap.entryType === LedgerEntryType.WALLET_TRANSFER &&
      leCap.entryType === LedgerEntryType.CAPTAIN_PREPAID_CHARGE &&
      money(capAfter.prepaidBalance).minus(money(preBal)).equals(money(capAmt)),
    details: { coDebitLedger: leCoCap.id, captainChargeLedger: leCap.id },
  });

  // —— 6–7) Idempotent replay: no second debit / same balance ——
  const c2 = await captainPrepaidBalanceService.chargeCaptainWithClientIdempotency({
    actor: prepaidActor(ca),
    captainId: ourCaptain.id,
    amount: capAmt,
    reason: "replay",
    idempotencyKey: capIdem,
  });
  const coAfterReplay = (await companyWalletService.getCompanyWalletBalance(companyActor(ca), ca.companyId!))
    .balanceCached;
  const capReplay = await prisma.captain.findUniqueOrThrow({ where: { id: ourCaptain.id } });
  const dupCo = await prisma.ledgerEntry.count({ where: { idempotencyKey: coDebitsK } });
  const cbtCount2 = await prisma.captainBalanceTransaction.count({
    where: { captainId: ourCaptain.id, prepaidLedgerOperationId: wantCapKey, type: CaptainBalanceTransactionType.CHARGE },
  });
  checks.push({
    id: "6_7_idempotency_replay",
    pass:
      c2.idempotent &&
      coAfterCap === coAfterReplay &&
      capReplay.prepaidBalance.toString() === capAfter.prepaidBalance.toString() &&
      dupCo === 1 &&
      cbtCount2 === 1,
    details: { idempotent: c2.idempotent },
  });

  // —— 8) Over balance → INSUFFICIENT_COMPANY_BALANCE ——
  const coBal2 = money((await companyWalletService.getCompanyWalletBalance(companyActor(ca), ca.companyId!)).balanceCached);
  const capToo = coBal2.plus(0.01).toFixed(2);
  let threwIns = false;
  try {
    await captainPrepaidBalanceService.chargeCaptainWithClientIdempotency({
      actor: prepaidActor(ca),
      captainId: ourCaptain.id,
      amount: capToo,
      reason: "should fail",
      idempotencyKey: `s41-badcap-${runKey}`,
    });
  } catch (e) {
    if (e instanceof AppError && e.code === "INSUFFICIENT_COMPANY_BALANCE") threwIns = true;
  }
  const coAfterFail = (await companyWalletService.getCompanyWalletBalance(companyActor(ca), ca.companyId!))
    .balanceCached;
  const badIdem = `s41-badcap-${runKey}`;
  const badCapLeg = financePrepaidChargeClientIdempotencyKey("company_admin", ourCaptain.id, badIdem);
  const badCoDebits = buildCompanyAdminCaptainCoDebitIdempotencyKey(ca.companyId, ourCaptain.id, badIdem);
  const noExtra =
    (await prisma.ledgerEntry.count({ where: { idempotencyKey: badCapLeg } })) === 0 &&
    (await prisma.ledgerEntry.count({ where: { idempotencyKey: badCoDebits } })) === 0 &&
    (await prisma.captainBalanceTransaction.count({ where: { prepaidLedgerOperationId: badCapLeg } })) === 0;
  checks.push({
    id: "8_insufficient_company_balance_409",
    pass: threwIns && coAfterFail === coAfterReplay && noExtra,
    details: { triedAmount: capToo, errorCode: "INSUFFICIENT_COMPANY_BALANCE" },
  });

  // —— 9) Cross-company captain ——
  try {
    await captainPrepaidBalanceService.chargeCaptainWithClientIdempotency({
      actor: prepaidActor(ca),
      captainId: otherCaptain.id,
      amount: "0.01",
      reason: "must fail",
      idempotencyKey: `s41-xco-${runKey}`,
    });
    checks.push({ id: "9_cross_company_captain_forbidden", pass: false });
  } catch (e) {
    assertCode(e, "FORBIDDEN");
    checks.push({ id: "9_cross_company_captain_forbidden", pass: true });
  }

  // —— 10) phase0 ——
  const v = spawnSync("npm run verify:phase0:tenant-negative", { cwd: apiRoot, shell: true, encoding: "utf8" });
  checks.push({ id: "10_verify_phase0", pass: v.status === 0, details: { exitCode: v.status } });

  const failed = checks.filter((c) => !c.pass);
  const summary = {
    generatedAt: new Date().toISOString(),
    phase: "S4.1",
    name: "storeless-company-finance",
    storeWalletRequired: false,
    phasePass: failed.length === 0,
    totalChecks: checks.length,
    failedChecks: failed.length,
    checks,
    note: "Does not run Company Admin store top-up. Use for Storeless Company Admin finance gate; legacy full matrix remains phase31 when STORELESS_COMPANY_ADMIN is unset.",
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
