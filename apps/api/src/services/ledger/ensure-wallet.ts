import { type Prisma, type WalletAccount, type WalletOwnerType } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/errors.js";

export type EnsureWalletAccountInput = {
  ownerType: WalletOwnerType;
  ownerId: string;
  companyId: string;
  currency?: string;
};

/**
 * Get or create a `WalletAccount` for an owner. If the wallet already exists, `companyId` must match.
 */
export async function ensureWalletAccount(input: EnsureWalletAccountInput): Promise<WalletAccount> {
  const currency = input.currency?.trim() || "ILS";
  const existing = await prisma.walletAccount.findUnique({
    where: { ownerType_ownerId: { ownerType: input.ownerType, ownerId: input.ownerId } },
  });
  if (existing) {
    if (existing.companyId !== input.companyId) {
      throw new AppError(409, "Wallet owner is already bound to a different company", "WALLET_COMPANY_MISMATCH");
    }
    return existing;
  }
  return prisma.walletAccount.create({
    data: {
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      companyId: input.companyId,
      currency,
    },
  });
}

/**
 * Same as `ensureWalletAccount` but uses an existing transaction client (atomic with other writes).
 */
export async function ensureWalletAccountInTx(
  tx: Prisma.TransactionClient,
  input: EnsureWalletAccountInput,
): Promise<WalletAccount> {
  const currency = input.currency?.trim() || "ILS";
  const existing = await tx.walletAccount.findUnique({
    where: { ownerType_ownerId: { ownerType: input.ownerType, ownerId: input.ownerId } },
  });
  if (existing) {
    if (existing.companyId !== input.companyId) {
      throw new AppError(409, "Wallet owner is already bound to a different company", "WALLET_COMPANY_MISMATCH");
    }
    return existing;
  }
  return tx.walletAccount.create({
    data: {
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      companyId: input.companyId,
      currency,
    },
  });
}
