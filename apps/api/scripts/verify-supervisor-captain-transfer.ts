/**
 * Service-level checks for supervisor → captain transfer. Requires DB.
 * Run: `npm run verify:supervisor-captain-transfer` from `apps/api`
 *
 * يستخدم COMPANY_ADMIN كمشرف محفظة (DISPATCHER غير معتمد).
 */
import "dotenv/config";
import { LedgerEntryType, UserRole, WalletOwnerType } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";
import { appendLedgerEntry, ensureWalletAccount } from "../src/services/ledger/index.js";
import { transferSupervisorWalletToMyCaptain } from "../src/services/supervisor-captain-transfer.service.js";
import { AppError } from "../src/utils/errors.js";

function assertAppError(e: unknown, code: string): void {
  if (!(e instanceof AppError) || e.code !== code) {
    throw e instanceof Error ? e : new Error(String(e));
  }
}

async function main() {
  const companyAdmin = await prisma.user.findFirst({
    where: { role: UserRole.COMPANY_ADMIN, isActive: true, companyId: { not: null } },
  });
  if (!companyAdmin?.companyId) {
    throw new Error("Need an active COMPANY_ADMIN with companyId (run seed).");
  }

  const captain = await prisma.captain.findFirst({
    where: { companyId: companyAdmin.companyId },
  });
  if (!captain) {
    throw new Error("Need a captain in the same company as the company admin.");
  }

  await prisma.captain.update({
    where: { id: captain.id },
    data: { supervisorUserId: companyAdmin.id },
  });

  const supWallet = await ensureWalletAccount({
    ownerType: WalletOwnerType.SUPERVISOR_USER,
    ownerId: companyAdmin.id,
    companyId: companyAdmin.companyId,
  });
  await appendLedgerEntry({
    walletAccountId: supWallet.id,
    entryType: LedgerEntryType.ADJUSTMENT,
    amount: "100.00",
    idempotencyKey: `verify-sc-fund-${Date.now()}`,
    createdByUserId: companyAdmin.id,
  });

  const key = `verify-sc-tx-${Date.now()}`;
  const t1 = await transferSupervisorWalletToMyCaptain({
    actorUserId: companyAdmin.id,
    actorRole: UserRole.COMPANY_ADMIN,
    actorCompanyId: companyAdmin.companyId,
    captainId: captain.id,
    amount: "12.50",
    idempotencyKey: key,
  });
  if (t1.idempotent) {
    throw new Error("first transfer should not be idempotent");
  }

  const t2 = await transferSupervisorWalletToMyCaptain({
    actorUserId: companyAdmin.id,
    actorRole: UserRole.COMPANY_ADMIN,
    actorCompanyId: companyAdmin.companyId,
    captainId: captain.id,
    amount: "12.50",
    idempotencyKey: key,
  });
  if (!t2.idempotent || t1.fromLedgerEntryId !== t2.fromLedgerEntryId) {
    throw new Error("idempotent replay mismatch");
  }

  try {
    await transferSupervisorWalletToMyCaptain({
      actorUserId: companyAdmin.id,
      actorRole: UserRole.COMPANY_ADMIN,
      actorCompanyId: companyAdmin.companyId,
      captainId: captain.id,
      amount: "999999.99",
      idempotencyKey: `verify-sc-broke-${Date.now()}`,
    });
    throw new Error("expected insufficient balance");
  } catch (e) {
    assertAppError(e, "WALLET_INSUFFICIENT_BALANCE");
  }

  await prisma.captain.update({
    where: { id: captain.id },
    data: { supervisorUserId: null },
  });
  try {
    await transferSupervisorWalletToMyCaptain({
      actorUserId: companyAdmin.id,
      actorRole: UserRole.COMPANY_ADMIN,
      actorCompanyId: companyAdmin.companyId,
      captainId: captain.id,
      amount: "1.00",
      idempotencyKey: `verify-sc-ns-${Date.now()}`,
    });
    throw new Error("expected not supervised");
  } catch (e) {
    assertAppError(e, "CAPTAIN_NOT_SUPERVISED");
  } finally {
    await prisma.captain.update({
      where: { id: captain.id },
      data: { supervisorUserId: companyAdmin.id },
    });
  }

  try {
    await transferSupervisorWalletToMyCaptain({
      actorUserId: companyAdmin.id,
      actorRole: UserRole.DISPATCHER,
      actorCompanyId: companyAdmin.companyId,
      captainId: captain.id,
      amount: "1.00",
      idempotencyKey: `verify-sc-role-${Date.now()}`,
    });
    throw new Error("expected DISPATCHER rejected");
  } catch (e) {
    assertAppError(e, "ROLE_NOT_SUPPORTED");
  }

  // eslint-disable-next-line no-console
  console.info("[verify-supervisor-captain-transfer] passed");
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
