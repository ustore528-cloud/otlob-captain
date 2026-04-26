import { LedgerEntryType, Prisma, UserRole, WalletOwnerType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/errors.js";
import { appendLedgerEntry, ensureWalletAccount, money } from "./ledger/index.js";

const SA_PREFIX_STORE = "sa-topup:store";
const SA_PREFIX_SUPERVISOR = "sa-topup:supervisor";

const SUPERVISOR_TOPUP_ROLES: UserRole[] = [UserRole.BRANCH_MANAGER, UserRole.DISPATCHER];

function assertSupervisorTopupEligible(user: { role: UserRole; companyId: string | null }): void {
  if (!user.companyId) {
    throw new AppError(400, "Target user must have a company", "SUPERVISOR_TOPUP_NO_COMPANY");
  }
  if (user.role === UserRole.CAPTAIN || user.role === UserRole.CUSTOMER) {
    throw new AppError(400, "Cannot top up wallet for this user role", "SUPERVISOR_TOPUP_ROLE_FORBIDDEN");
  }
  if (!SUPERVISOR_TOPUP_ROLES.includes(user.role)) {
    throw new AppError(400, "Supervisor wallet top-up is only for branch managers and dispatchers", "SUPERVISOR_TOPUP_ROLE_NOT_ALLOWED");
  }
}

export type TopUpResult = {
  walletAccountId: string;
  ledgerEntryId: string;
  newBalanceCached: string;
  idempotent: boolean;
};

function toResult(r: { idempotent: boolean; entry: { id: string }; account: { id: string; balanceCached: Prisma.Decimal } }): TopUpResult {
  return {
    walletAccountId: r.account.id,
    ledgerEntryId: r.entry.id,
    newBalanceCached: money(r.account.balanceCached).toFixed(2),
    idempotent: r.idempotent,
  };
}

export const superAdminWalletTopupService = {
  async topUpStoreWallet(input: {
    storeId: string;
    amount: Prisma.Decimal | string | number;
    idempotencyKey: string;
    createdByUserId: string;
    currency?: string;
  }): Promise<TopUpResult> {
    const store = await prisma.store.findUnique({ where: { id: input.storeId } });
    if (!store) {
      throw new AppError(404, "Store not found", "STORE_NOT_FOUND");
    }
    const wallet = await ensureWalletAccount({
      ownerType: WalletOwnerType.STORE,
      ownerId: store.id,
      companyId: store.companyId,
      currency: input.currency,
    });
    const idem = `${SA_PREFIX_STORE}:${input.storeId}:${input.idempotencyKey.trim()}`;
    const r = await appendLedgerEntry({
      walletAccountId: wallet.id,
      entryType: LedgerEntryType.SUPER_ADMIN_TOP_UP,
      amount: money(input.amount),
      idempotencyKey: idem,
      currency: input.currency,
      createdByUserId: input.createdByUserId,
      referenceType: "STORE",
      referenceId: store.id,
    });
    return toResult(r);
  },

  async topUpSupervisorUserWallet(input: {
    userId: string;
    amount: Prisma.Decimal | string | number;
    idempotencyKey: string;
    createdByUserId: string;
    currency?: string;
  }): Promise<TopUpResult> {
    const user = await prisma.user.findUnique({ where: { id: input.userId } });
    if (!user) {
      throw new AppError(404, "User not found", "USER_NOT_FOUND");
    }
    assertSupervisorTopupEligible(user);
    const wallet = await ensureWalletAccount({
      ownerType: WalletOwnerType.SUPERVISOR_USER,
      ownerId: user.id,
      companyId: user.companyId!,
      currency: input.currency,
    });
    const idem = `${SA_PREFIX_SUPERVISOR}:${input.userId}:${input.idempotencyKey.trim()}`;
    const r = await appendLedgerEntry({
      walletAccountId: wallet.id,
      entryType: LedgerEntryType.SUPER_ADMIN_TOP_UP,
      amount: money(input.amount),
      idempotencyKey: idem,
      currency: input.currency,
      createdByUserId: input.createdByUserId,
      referenceType: "SUPERVISOR_USER",
      referenceId: user.id,
    });
    return toResult(r);
  },

  async adjustSupervisorUserWallet(input: {
    userId: string;
    amount: Prisma.Decimal | string | number;
    note: string;
    idempotencyKey: string;
    createdByUserId: string;
    currency?: string;
  }): Promise<TopUpResult> {
    const user = await prisma.user.findUnique({ where: { id: input.userId } });
    if (!user) {
      throw new AppError(404, "User not found", "USER_NOT_FOUND");
    }
    assertSupervisorTopupEligible(user);
    const wallet = await ensureWalletAccount({
      ownerType: WalletOwnerType.SUPERVISOR_USER,
      ownerId: user.id,
      companyId: user.companyId!,
      currency: input.currency,
    });
    const idem = `${SA_PREFIX_SUPERVISOR}:adjust:${input.userId}:${input.idempotencyKey.trim()}`;
    const r = await appendLedgerEntry({
      walletAccountId: wallet.id,
      entryType: LedgerEntryType.ADJUSTMENT,
      amount: money(input.amount),
      idempotencyKey: idem,
      currency: input.currency,
      createdByUserId: input.createdByUserId,
      referenceType: "SUPERVISOR_USER",
      referenceId: user.id,
      metadata: { note: input.note.trim() },
    });
    return toResult(r);
  },
};
