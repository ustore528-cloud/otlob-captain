import { LedgerEntryType, Prisma, WalletOwnerType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/errors.js";
import { isCompanyAdminRole, type AppRole } from "../lib/rbac-roles.js";
import { appendLedgerEntryInTx, ensureWalletAccountInTx, money } from "./ledger/index.js";

const CA_PREFIX_STORE = "ca-topup:store";

const LEDGER_TX = {
  maxWait: 10_000,
  timeout: 30_000,
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
} as const;

export type CompanyAdminStoreTopUpActor = {
  userId: string;
  role: AppRole;
  companyId: string | null;
  branchId: string | null;
};

export type CompanyAdminStoreTopUpResult = {
  storeId: string;
  walletAccountId: string;
  ledgerEntryId: string;
  balanceBefore: string;
  balanceAfter: string;
  idempotent: boolean;
  idempotencyKey: string;
};

/**
 * Company Admin: add funds to a **store** wallet in their own company only.
 * `companyId` is taken from the actor only; never from the client.
 */
export async function companyAdminTopUpStoreWallet(
  actor: CompanyAdminStoreTopUpActor,
  input: {
    storeId: string;
    amount: Prisma.Decimal | string | number;
    reason: string;
    idempotencyKey: string;
    currency?: string;
  },
): Promise<CompanyAdminStoreTopUpResult> {
  if (!isCompanyAdminRole(actor.role)) {
    throw new AppError(403, "Forbidden", "FORBIDDEN");
  }
  if (!actor.companyId) {
    throw new AppError(403, "Company scope is required on your account for this operation.", "TENANT_SCOPE_REQUIRED");
  }
  const reason = input.reason.trim();
  if (!reason) {
    throw new AppError(400, "Reason is required", "REASON_REQUIRED");
  }
  const clientIdem = input.idempotencyKey.trim();
  if (!clientIdem) {
    throw new AppError(400, "idempotencyKey is required", "LEDGER_IDEMPOTENCY_KEY_REQUIRED");
  }
  const amt = money(input.amount);
  if (amt.lte(0)) {
    throw new AppError(400, "Amount must be positive", "LEDGER_AMOUNT_INVALID");
  }

  return prisma.$transaction(async (tx) => {
    const store = await tx.store.findUnique({ where: { id: input.storeId } });
    if (!store) {
      throw new AppError(404, "Store not found", "STORE_NOT_FOUND");
    }
    if (store.companyId !== actor.companyId) {
      throw new AppError(403, "Forbidden", "FORBIDDEN");
    }
    const wallet = await ensureWalletAccountInTx(tx, {
      ownerType: WalletOwnerType.STORE,
      ownerId: store.id,
      companyId: store.companyId,
      currency: input.currency,
    });
    const balanceBefore = money(wallet.balanceCached).toFixed(2);
    const idem = `${CA_PREFIX_STORE}:${input.storeId}:${clientIdem}`;
    const r = await appendLedgerEntryInTx(tx, {
      walletAccountId: wallet.id,
      entryType: LedgerEntryType.SUPER_ADMIN_TOP_UP,
      amount: amt,
      idempotencyKey: idem,
      currency: input.currency,
      createdByUserId: actor.userId,
      referenceType: "STORE",
      referenceId: store.id,
      metadata: { source: "company_admin_store_wallet_topup", reason },
    });
    return {
      storeId: store.id,
      walletAccountId: r.account.id,
      ledgerEntryId: r.entry.id,
      balanceBefore,
      balanceAfter: money(r.account.balanceCached).toFixed(2),
      idempotent: r.idempotent,
      idempotencyKey: clientIdem,
    };
  }, LEDGER_TX);
}

export const companyAdminStoreWalletTopupService = { topUpStoreWallet: companyAdminTopUpStoreWallet };
