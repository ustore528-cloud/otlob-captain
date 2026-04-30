import { Prisma, UserRole, WalletOwnerType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/errors.js";
import { ensureWalletAccount, money, transfer, TRANSFER_FROM_KEY_SUFFIX } from "./ledger/index.js";

const NS_PREFIX = "sc-transfer";

export type SupervisorCaptainTransferResult = {
  fromWalletAccountId: string;
  toWalletAccountId: string;
  fromLedgerEntryId: string;
  toLedgerEntryId: string;
  newFromBalanceCached: string;
  newToBalanceCached: string;
  idempotent: boolean;
};

/**
 * Supervisor (`SUPERVISOR_USER` wallet) → captain (`CAPTAIN` wallet) transfer.
 * Only when `Captain.supervisorUserId` is the actor. Enforces non-negative supervisor balance (first attempt only).
 * الأدوار المعتمدة: COMPANY_ADMIN (ضمن شركة) أو SUPER_ADMIN (يستخدم شركة الكابتن للمحافظ).
 */
export async function transferSupervisorWalletToMyCaptain(input: {
  actorUserId: string;
  actorRole: UserRole;
  actorCompanyId: string | null;
  captainId: string;
  amount: Prisma.Decimal | string | number;
  idempotencyKey: string;
  currency?: string;
}): Promise<SupervisorCaptainTransferResult> {
  const allowedRoles = new Set<UserRole>([UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN]);
  if (!allowedRoles.has(input.actorRole)) {
    throw new AppError(403, "This account role is not supported for supervisor transfers.", "ROLE_NOT_SUPPORTED");
  }

  const captain = await prisma.captain.findUnique({ where: { id: input.captainId } });
  if (!captain) {
    throw new AppError(404, "Captain not found", "CAPTAIN_NOT_FOUND");
  }

  let actorCompanyForWallets: string;
  if (input.actorRole === UserRole.SUPER_ADMIN) {
    actorCompanyForWallets = captain.companyId;
  } else {
    if (input.actorCompanyId == null || input.actorCompanyId === "") {
      throw new AppError(400, "Company scope is required", "COMPANY_SCOPE_REQUIRED");
    }
    if (captain.companyId !== input.actorCompanyId) {
      throw new AppError(403, "Captain is not in your company", "CAPTAIN_COMPANY_MISMATCH");
    }
    actorCompanyForWallets = input.actorCompanyId;
  }

  if (captain.supervisorUserId !== input.actorUserId) {
    throw new AppError(403, "You can only transfer to captains you supervise", "CAPTAIN_NOT_SUPERVISED");
  }

  const actorCompanyId = actorCompanyForWallets;

  const amountAbs = money(input.amount);

  const fromWallet = await ensureWalletAccount({
    ownerType: WalletOwnerType.SUPERVISOR_USER,
    ownerId: input.actorUserId,
    companyId: actorCompanyId,
    currency: input.currency,
  });
  const toWallet = await ensureWalletAccount({
    ownerType: WalletOwnerType.CAPTAIN,
    ownerId: captain.id,
    companyId: captain.companyId,
    currency: input.currency,
  });

  const baseKey = `${NS_PREFIX}:${input.actorUserId}:${input.captainId}:${input.idempotencyKey.trim()}`;
  const fromLegKey = baseKey + TRANSFER_FROM_KEY_SUFFIX;

  const existingFromLeg = await prisma.ledgerEntry.findUnique({ where: { idempotencyKey: fromLegKey } });
  if (!existingFromLeg) {
    const fromBal = await prisma.walletAccount.findUnique({ where: { id: fromWallet.id } });
    if (!fromBal || money(fromBal.balanceCached).lt(amountAbs)) {
      throw new AppError(400, "Insufficient balance", "WALLET_INSUFFICIENT_BALANCE");
    }
  }

  const t = await transfer({
    fromAccountId: fromWallet.id,
    toAccountId: toWallet.id,
    amount: amountAbs,
    idempotencyKey: baseKey,
    createdByUserId: input.actorUserId,
    metadata: { kind: "supervisor_to_captain", captainId: captain.id },
  });

  const fromAcc = await prisma.walletAccount.findUniqueOrThrow({ where: { id: fromWallet.id } });
  const toAcc = await prisma.walletAccount.findUniqueOrThrow({ where: { id: toWallet.id } });

  return {
    fromWalletAccountId: fromWallet.id,
    toWalletAccountId: toWallet.id,
    fromLedgerEntryId: t.from.id,
    toLedgerEntryId: t.to.id,
    newFromBalanceCached: money(fromAcc.balanceCached).toFixed(2),
    newToBalanceCached: money(toAcc.balanceCached).toFixed(2),
    idempotent: t.idempotent,
  };
}
