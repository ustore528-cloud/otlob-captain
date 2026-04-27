import { type LedgerEntry, LedgerEntryType, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/errors.js";
import { appendLedgerEntryInTx, type AppendLedgerEntryInput } from "./append-ledger-entry.js";
import { money, ZERO } from "./money.js";

const TX_OPTS = {
  maxWait: 10_000,
  timeout: 30_000,
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
} as const;

/** Distinct sub-keys for the two `WALLET_TRANSFER` legs so a transfer shares one business idempotency key. */
export const TRANSFER_FROM_KEY_SUFFIX = "::WALLET_TRANSFER:from";
export const TRANSFER_TO_KEY_SUFFIX = "::WALLET_TRANSFER:to";

export type TransferInput = {
  fromAccountId: string;
  toAccountId: string;
  /** Unsigned transfer amount; the from-line is negated, the to-line is positive. */
  amount: Prisma.Decimal | number | string;
  idempotencyKey: string;
  createdByUserId?: string | null;
  /**
   * Stored on both legs; may include a shared `transferIdempotencyKey` for traceability.
   * Use `metadataFrom` / `metadataTo` to set different `source` per leg.
   */
  metadata?: Prisma.InputJsonValue;
  metadataFrom?: Prisma.InputJsonValue;
  metadataTo?: Prisma.InputJsonValue;
};

export type TransferResult = {
  idempotent: boolean;
  from: LedgerEntry;
  to: LedgerEntry;
};

/**
 * If true, before creating new legs, require `from` wallet `balanceCached >= amount`.
 * Skipped when both legs already exist (idempotent replay) or `skipBalanceCheck` is set.
 */
export type TransferInTxOptions = {
  requireFromBalanceGteAmount?: boolean;
  /** e.g. company-admin top-up; Super Admin / seed transfers may set false. */
  skipBalanceCheck?: boolean;
};

function mergeLegMeta(
  base: Prisma.InputJsonValue | undefined,
  leg: Prisma.InputJsonValue | undefined,
  transferKey: string,
): Prisma.InputJsonValue {
  const baseObj = base === undefined ? {} : (typeof base === "object" && base !== null && !Array.isArray(base) ? { ...(base as object) } : { value: base });
  const legObj = leg === undefined ? {} : (typeof leg === "object" && leg !== null && !Array.isArray(leg) ? { ...(leg as object) } : { value: leg });
  return { ...baseObj, ...legObj, transferIdempotencyKey: transferKey } as Prisma.InputJsonValue;
}

/**
 * Transfers by appending two `WALLET_TRANSFER` lines with a shared logical idempotency key
 * (per-leg sub-keys). Optional balance check on the **from** account.
 */
export async function transferInTx(
  tx: Prisma.TransactionClient,
  input: TransferInput,
  opts: TransferInTxOptions = {},
): Promise<TransferResult> {
  if (input.fromAccountId === input.toAccountId) {
    throw new AppError(400, "Transfer requires two distinct accounts", "WALLET_TRANSFER_SAME_ACCOUNT");
  }
  if (typeof input.idempotencyKey !== "string" || input.idempotencyKey.trim() === "") {
    throw new AppError(400, "idempotencyKey is required", "LEDGER_IDEMPOTENCY_KEY_REQUIRED");
  }
  const baseKey = input.idempotencyKey.trim();
  const amountAbs = money(input.amount);
  if (amountAbs.lte(ZERO)) {
    throw new AppError(400, "Transfer amount must be positive", "WALLET_TRANSFER_INVALID_AMOUNT");
  }
  const fromKey = baseKey + TRANSFER_FROM_KEY_SUFFIX;
  const toKey = baseKey + TRANSFER_TO_KEY_SUFFIX;
  const neg = amountAbs.negated();
  const metaFrom = mergeLegMeta(input.metadata, input.metadataFrom, baseKey);
  const metaTo = mergeLegMeta(input.metadata, input.metadataTo, baseKey);

  const existingFrom = await tx.ledgerEntry.findUnique({ where: { idempotencyKey: fromKey } });
  if (existingFrom) {
    const existingTo = await tx.ledgerEntry.findUnique({ where: { idempotencyKey: toKey } });
    if (!existingTo) {
      throw new AppError(500, "Inconsistent transfer: from leg without to leg", "WALLET_TRANSFER_INCOMPLETE");
    }
    if (existingFrom.walletAccountId !== input.fromAccountId || existingTo.walletAccountId !== input.toAccountId) {
      throw new AppError(409, "idempotencyKey already used for a different transfer", "LEDGER_IDEMPOTENCY_CONFLICT");
    }
    return { idempotent: true, from: existingFrom, to: existingTo };
  }
  if (await tx.ledgerEntry.findUnique({ where: { idempotencyKey: toKey } })) {
    throw new AppError(500, "Inconsistent transfer: to leg without from leg", "WALLET_TRANSFER_INCOMPLETE");
  }

  const fromAcc = await tx.walletAccount.findUnique({ where: { id: input.fromAccountId } });
  const toAcc = await tx.walletAccount.findUnique({ where: { id: input.toAccountId } });
  if (!fromAcc || !toAcc) {
    throw new AppError(404, "Wallet account not found", "WALLET_NOT_FOUND");
  }
  if (fromAcc.currency !== toAcc.currency) {
    throw new AppError(400, "Wallets have different currency", "WALLET_CURRENCY_MISMATCH");
  }

  if (opts.requireFromBalanceGteAmount && !opts.skipBalanceCheck) {
    if (money(fromAcc.balanceCached).lt(amountAbs)) {
      throw new AppError(409, "Insufficient company wallet balance for this top-up", "INSUFFICIENT_COMPANY_BALANCE");
    }
  }

  const fromIn: AppendLedgerEntryInput = {
    walletAccountId: input.fromAccountId,
    entryType: LedgerEntryType.WALLET_TRANSFER,
    amount: neg,
    idempotencyKey: fromKey,
    counterpartyAccountId: input.toAccountId,
    createdByUserId: input.createdByUserId,
    metadata: metaFrom,
  };
  const toIn: AppendLedgerEntryInput = {
    walletAccountId: input.toAccountId,
    entryType: LedgerEntryType.WALLET_TRANSFER,
    amount: amountAbs,
    idempotencyKey: toKey,
    counterpartyAccountId: input.fromAccountId,
    createdByUserId: input.createdByUserId,
    metadata: metaTo,
  };

  const r1 = await appendLedgerEntryInTx(tx, fromIn);
  const r2 = await appendLedgerEntryInTx(tx, toIn);
  return { idempotent: r1.idempotent && r2.idempotent, from: r1.entry, to: r2.entry };
}

export async function transfer(input: TransferInput): Promise<TransferResult> {
  return prisma.$transaction((tx) => transferInTx(tx, input, {}), TX_OPTS);
}
