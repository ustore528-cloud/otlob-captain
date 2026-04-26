import {
  type LedgerEntry,
  type WalletAccount,
  type LedgerEntryType,
  Prisma,
} from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/errors.js";
import { money, ZERO } from "./money.js";

const TX_OPTS = {
  maxWait: 10_000,
  timeout: 30_000,
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
} as const;

export type AppendLedgerEntryInput = {
  walletAccountId: string;
  entryType: LedgerEntryType;
  /**
   * Signed: positive adds to the wallet, negative debits the wallet.
   */
  amount: Prisma.Decimal | number | string;
  idempotencyKey: string;
  currency?: string;
  orderId?: string | null;
  counterpartyAccountId?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  metadata?: Prisma.InputJsonValue;
  createdByUserId?: string | null;
};

export type AppendLedgerEntryResult = {
  idempotent: boolean;
  entry: LedgerEntry;
  account: WalletAccount;
};

function requireIdempotencyKey(key: string): void {
  if (typeof key !== "string" || key.trim() === "") {
    throw new AppError(400, "idempotencyKey is required", "LEDGER_IDEMPOTENCY_KEY_REQUIRED");
  }
}

/**
 * Appends a single ledger line and updates `balanceCached` in the same transaction.
 * Replays the same `idempotencyKey` return the original entry without mutating the balance.
 */
export async function appendLedgerEntryInTx(
  tx: Prisma.TransactionClient,
  input: AppendLedgerEntryInput,
): Promise<AppendLedgerEntryResult> {
  requireIdempotencyKey(input.idempotencyKey);
  const idempotencyKey = input.idempotencyKey.trim();

  const amount = money(input.amount);
  if (amount.equals(ZERO)) {
    throw new AppError(400, "Amount must be non-zero", "LEDGER_AMOUNT_ZERO");
  }

  const existing = await tx.ledgerEntry.findUnique({ where: { idempotencyKey } });
  if (existing) {
    if (existing.walletAccountId !== input.walletAccountId) {
      throw new AppError(409, "idempotencyKey already used for a different wallet", "LEDGER_IDEMPOTENCY_CONFLICT");
    }
    const account = await tx.walletAccount.findUniqueOrThrow({ where: { id: input.walletAccountId } });
    return { idempotent: true, entry: existing, account };
  }

  const accountRow = await tx.walletAccount.findUnique({ where: { id: input.walletAccountId } });
  if (!accountRow) {
    throw new AppError(404, "Wallet account not found", "WALLET_NOT_FOUND");
  }
  const currency = input.currency?.trim() || accountRow.currency;
  if (input.currency && input.currency.trim() !== accountRow.currency) {
    throw new AppError(400, "currency does not match the wallet", "WALLET_CURRENCY_MISMATCH");
  }

  let entry: LedgerEntry;
  try {
    entry = await tx.ledgerEntry.create({
      data: {
        walletAccountId: input.walletAccountId,
        entryType: input.entryType,
        amount,
        currency,
        idempotencyKey,
        orderId: input.orderId ?? undefined,
        counterpartyAccountId: input.counterpartyAccountId ?? undefined,
        referenceType: input.referenceType ?? undefined,
        referenceId: input.referenceId ?? undefined,
        metadata: input.metadata === undefined ? undefined : (input.metadata as object),
        createdByUserId: input.createdByUserId ?? undefined,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const again = await tx.ledgerEntry.findUnique({ where: { idempotencyKey } });
      if (again) {
        if (again.walletAccountId !== input.walletAccountId) {
          throw new AppError(409, "idempotencyKey already used for a different wallet", "LEDGER_IDEMPOTENCY_CONFLICT");
        }
        const account = await tx.walletAccount.findUniqueOrThrow({ where: { id: input.walletAccountId } });
        return { idempotent: true, entry: again, account };
      }
    }
    throw e;
  }

  await tx.walletAccount.update({
    where: { id: input.walletAccountId },
    data: { balanceCached: { increment: amount } },
  });
  const account = await tx.walletAccount.findUniqueOrThrow({ where: { id: input.walletAccountId } });
  return { idempotent: false, entry, account };
}

export async function appendLedgerEntry(input: AppendLedgerEntryInput): Promise<AppendLedgerEntryResult> {
  return prisma.$transaction((tx) => appendLedgerEntryInTx(tx, input), TX_OPTS);
}
