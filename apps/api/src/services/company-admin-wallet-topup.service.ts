import { Prisma, WalletOwnerType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/errors.js";
import { isCompanyAdminRole, type AppRole } from "../lib/rbac-roles.js";
import { getOrCreateCompanyWallet } from "./company-wallet.service.js";
import { money } from "./ledger/money.js";
import { ensureWalletAccountInTx } from "./ledger/index.js";
import { transferInTx, type TransferInTxOptions } from "./ledger/transfer.js";

/** ReadCommitted: two `WALLET_TRANSFER` legs in one tx can dead-lock under `Serializable` on some DBs. */
const LEDGER_TX = {
  maxWait: 10_000,
  timeout: 30_000,
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
} as const;

/** Namespace for company → store CA top-up; paired legs use `::WALLET_TRANSFER:from` / `::WALLET_TRANSFER:to`. */
export const COMPANY_ADMIN_STORE_TOPUP_BASE_PREFIX = "ca31:co-to-store" as const;

export function buildCompanyAdminStoreTopUpTransferBase(
  companyId: string,
  storeId: string,
  clientIdempotencyKey: string,
): string {
  return `${COMPANY_ADMIN_STORE_TOPUP_BASE_PREFIX}:${companyId}:${storeId}:${clientIdempotencyKey.trim()}`;
}

export type CompanyAdminStoreTopUpActor = {
  userId: string;
  role: AppRole;
  companyId: string | null;
  branchId: string | null;
};

export type CompanyAdminStoreTopUpResult = {
  storeId: string;
  walletAccountId: string;
  /** Ledger line on the **store** (credit) leg. */
  ledgerEntryId: string;
  companyLedgerEntryId: string;
  balanceBefore: string;
  balanceAfter: string;
  idempotent: boolean;
  idempotencyKey: string;
};

/**
 * Company Admin: move funds from the **company** wallet to a **store** wallet (same company only).
 * `companyId` is taken from the actor only; never from the client.
 * Insufficient company balance → 409 `INSUFFICIENT_COMPANY_BALANCE`.
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

    const companyWallet = await getOrCreateCompanyWallet(actor.companyId, tx);
    const storeCurrency = input.currency?.trim() || companyWallet.currency;
    const storeWallet = await ensureWalletAccountInTx(tx, {
      ownerType: WalletOwnerType.STORE,
      ownerId: store.id,
      companyId: store.companyId,
      currency: storeCurrency,
    });
    if (storeWallet.currency !== companyWallet.currency) {
      throw new AppError(
        400,
        "Store wallet currency must match the company wallet for this transfer",
        "WALLET_CURRENCY_MISMATCH",
      );
    }

    const balanceBefore = money(storeWallet.balanceCached).toFixed(2);
    const base = buildCompanyAdminStoreTopUpTransferBase(actor.companyId, store.id, clientIdem);

    const commonMeta = {
      companyId: actor.companyId,
      storeId: store.id,
      reason,
      operation: "company_admin_store_topup",
    } as const;

    const transferOpts: TransferInTxOptions = { requireFromBalanceGteAmount: true };

    const tr = await transferInTx(
      tx,
      {
        fromAccountId: companyWallet.id,
        toAccountId: storeWallet.id,
        amount: amt,
        idempotencyKey: base,
        createdByUserId: actor.userId,
        metadataFrom: { ...commonMeta, source: "company_admin_store_topup_company_debit" },
        metadataTo: { ...commonMeta, source: "company_admin_store_topup_store_credit" },
      },
      transferOpts,
    );

    const storeAcc = await tx.walletAccount.findUniqueOrThrow({ where: { id: storeWallet.id } });
    return {
      storeId: store.id,
      walletAccountId: storeAcc.id,
      ledgerEntryId: tr.to.id,
      companyLedgerEntryId: tr.from.id,
      balanceBefore,
      balanceAfter: money(storeAcc.balanceCached).toFixed(2),
      idempotent: tr.idempotent,
      idempotencyKey: clientIdem,
    };
  }, LEDGER_TX);
}

export const companyAdminStoreWalletTopupService = { topUpStoreWallet: companyAdminTopUpStoreWallet };
