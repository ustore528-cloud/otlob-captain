import type { Prisma, WalletAccount, WalletOwnerType } from "@prisma/client";
import { LedgerEntryType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/errors.js";
import { money } from "./ledger/money.js";
import {
  assertCanReadCaptainWallet,
  assertCanReadMySupervisorWallet,
  assertCanReadStoreWallet,
  assertCanReadWalletAccount,
} from "./wallet-read-access.service.js";
import type { AppRole } from "../lib/rbac-roles.js";

const DEFAULT_CURRENCY = "ILS";
const MAX_LEDGER_PAGE = 50;
const DEFAULT_LEDGER_LIMIT = 20;

function syntheticBalance(ownerType: WalletOwnerType, ownerId: string, companyId: string): WalletBalanceDto {
  return {
    walletAccountId: null,
    companyId,
    ownerType,
    ownerId,
    balanceCached: "0.00",
    currency: DEFAULT_CURRENCY,
    exists: false,
  };
}

function toBalanceDto(a: WalletAccount): WalletBalanceDto {
  return {
    walletAccountId: a.id,
    companyId: a.companyId,
    ownerType: a.ownerType,
    ownerId: a.ownerId,
    balanceCached: money(a.balanceCached).toFixed(2),
    currency: a.currency,
    exists: true,
  };
}

const SAFE_METADATA_KEYS = new Set([
  "orderNumber",
  "leg",
  "kind",
  "transferIdempotencyKey",
  "captainId",
  "transferGroup",
]);

function toSafeMetadata(meta: Prisma.JsonValue | null | undefined): Record<string, string> | null {
  if (meta == null) return null;
  if (typeof meta !== "object" || Array.isArray(meta)) return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(meta as Record<string, unknown>)) {
    if (!SAFE_METADATA_KEYS.has(k)) continue;
    if (v === null || v === undefined) continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      out[k] = String(v);
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

export type WalletBalanceDto = {
  walletAccountId: string | null;
  companyId: string;
  ownerType: WalletOwnerType;
  ownerId: string;
  balanceCached: string;
  currency: string;
  /** False when no `wallet_accounts` row has been created yet (synthetic zero). */
  exists: boolean;
};

export type LedgerEntryReadDto = {
  id: string;
  createdAt: string;
  entryType: LedgerEntryType;
  amount: string;
  currency: string;
  orderId: string | null;
  referenceType: string | null;
  referenceId: string | null;
  counterpartyAccountId: string | null;
  metadata: Record<string, string> | null;
};

export type LedgerHistoryPageDto = {
  items: LedgerEntryReadDto[];
  nextOffset: number | null;
  totalReturned: number;
};

export type LedgerActivityReportDto = {
  walletAccountId: string;
  range: { from: string; to: string };
  items: LedgerEntryReadDto[];
  nextOffset: number | null;
  totalReturned: number;
  totalInRange: number;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_LEDGER_ACTIVITY_RANGE_DAYS = 90;
const MAX_RANGE_MS = MAX_LEDGER_ACTIVITY_RANGE_DAYS * MS_PER_DAY;

type Actor = {
  userId: string;
  role: AppRole;
  companyId: string | null;
  branchId: string | null;
};

export const walletReadService = {
  async getStoreBalance(storeId: string, actor: Actor): Promise<WalletBalanceDto> {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, companyId: true, branchId: true, ownerUserId: true },
    });
    if (!store) {
      throw new (await import("../utils/errors.js")).AppError(404, "Store not found", "NOT_FOUND");
    }
    await assertCanReadStoreWallet(actor.role, actor.userId, actor.companyId, actor.branchId, store);

    const row = await prisma.walletAccount.findUnique({
      where: { ownerType_ownerId: { ownerType: "STORE", ownerId: storeId } },
    });
    if (!row) {
      return syntheticBalance("STORE", storeId, store.companyId);
    }
    if (row.companyId !== store.companyId) {
      throw new AppError(500, "Wallet company mismatch", "INTERNAL");
    }
    return toBalanceDto(row);
  },

  async getCaptainBalance(captainId: string, actor: Actor): Promise<WalletBalanceDto> {
    const captain = await prisma.captain.findUnique({
      where: { id: captainId },
      select: { id: true, companyId: true, branchId: true },
    });
    if (!captain) {
      throw new AppError(404, "Captain not found", "NOT_FOUND");
    }
    await assertCanReadCaptainWallet(actor.role, actor.userId, actor.companyId, actor.branchId, captain);

    const row = await prisma.walletAccount.findUnique({
      where: { ownerType_ownerId: { ownerType: "CAPTAIN", ownerId: captainId } },
    });
    if (!row) {
      return syntheticBalance("CAPTAIN", captainId, captain.companyId);
    }
    if (row.companyId !== captain.companyId) {
      throw new AppError(500, "Wallet company mismatch", "INTERNAL");
    }
    return toBalanceDto(row);
  },

  async getMySupervisorBalance(actor: Actor): Promise<WalletBalanceDto> {
    assertCanReadMySupervisorWallet(actor.role, actor.companyId);
    const companyId = actor.companyId!;

    const row = await prisma.walletAccount.findUnique({
      where: { ownerType_ownerId: { ownerType: "SUPERVISOR_USER", ownerId: actor.userId } },
    });
    if (!row) {
      return syntheticBalance("SUPERVISOR_USER", actor.userId, companyId);
    }
    if (row.companyId !== companyId) {
      throw new AppError(500, "Wallet company mismatch", "INTERNAL");
    }
    return toBalanceDto(row);
  },

  async listLedgerEntries(
    walletAccountId: string,
    actor: Actor,
    params: { offset: number; limit: number },
  ): Promise<LedgerHistoryPageDto> {
    const account = await prisma.walletAccount.findUnique({ where: { id: walletAccountId } });
    if (!account) {
      throw new AppError(404, "Wallet account not found", "NOT_FOUND");
    }
    await assertCanReadWalletAccount(actor.role, actor.userId, actor.companyId, actor.branchId, account);

    const limit = Math.min(Math.max(1, params.limit), MAX_LEDGER_PAGE);
    const offset = Math.max(0, params.offset);
    const rows = await prisma.ledgerEntry.findMany({
      where: { walletAccountId: account.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
      skip: offset,
      select: {
        id: true,
        createdAt: true,
        entryType: true,
        amount: true,
        currency: true,
        orderId: true,
        referenceType: true,
        referenceId: true,
        counterpartyAccountId: true,
        metadata: true,
      },
    });
    const items: LedgerEntryReadDto[] = rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      entryType: r.entryType,
      amount: money(r.amount).toFixed(2),
      currency: r.currency,
      orderId: r.orderId,
      referenceType: r.referenceType,
      referenceId: r.referenceId,
      counterpartyAccountId: r.counterpartyAccountId,
      metadata: toSafeMetadata(r.metadata as Prisma.JsonValue),
    }));
    const nextOffset = rows.length === limit ? offset + limit : null;
    return { items, nextOffset, totalReturned: items.length };
  },

  /**
   * Ledger lines in `[from, to]` (UTC, inclusive) for one wallet. Same row contract as `listLedgerEntries`.
   */
  async listLedgerActivityReport(
    walletAccountId: string,
    actor: Actor,
    params: { from: string; to: string; offset: number; limit: number },
  ): Promise<LedgerActivityReportDto> {
    const fromMs = Date.parse(params.from);
    const toMs = Date.parse(params.to);
    if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
      throw new AppError(400, "from and to must be valid ISO-8601 datetimes (UTC instants)", "INVALID_RANGE");
    }
    if (fromMs > toMs) {
      throw new AppError(400, "from must be on or before to", "INVALID_RANGE");
    }
    if (toMs - fromMs > MAX_RANGE_MS) {
      throw new AppError(
        400,
        `Date range may not exceed ${MAX_LEDGER_ACTIVITY_RANGE_DAYS} days`,
        "LEDGER_REPORT_RANGE_TOO_LARGE",
      );
    }
    const from = new Date(fromMs);
    const to = new Date(toMs);

    const account = await prisma.walletAccount.findUnique({ where: { id: walletAccountId } });
    if (!account) {
      throw new AppError(404, "Wallet account not found", "NOT_FOUND");
    }
    await assertCanReadWalletAccount(actor.role, actor.userId, actor.companyId, actor.branchId, account);

    const where = { walletAccountId: account.id, createdAt: { gte: from, lte: to } } as const;
    const limit = Math.min(Math.max(1, params.limit), MAX_LEDGER_PAGE);
    const offset = Math.max(0, params.offset);

    const [rows, totalInRange] = await Promise.all([
      prisma.ledgerEntry.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit,
        skip: offset,
        select: {
          id: true,
          createdAt: true,
          entryType: true,
          amount: true,
          currency: true,
          orderId: true,
          referenceType: true,
          referenceId: true,
          counterpartyAccountId: true,
          metadata: true,
        },
      }),
      prisma.ledgerEntry.count({ where }),
    ]);
    const items: LedgerEntryReadDto[] = rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      entryType: r.entryType,
      amount: money(r.amount).toFixed(2),
      currency: r.currency,
      orderId: r.orderId,
      referenceType: r.referenceType,
      referenceId: r.referenceId,
      counterpartyAccountId: r.counterpartyAccountId,
      metadata: toSafeMetadata(r.metadata as Prisma.JsonValue),
    }));
    const hasMore = offset + items.length < totalInRange;
    const nextOffset = hasMore ? offset + limit : null;
    return {
      walletAccountId: account.id,
      range: { from: from.toISOString(), to: to.toISOString() },
      items,
      nextOffset,
      totalReturned: items.length,
      totalInRange,
    };
  },
};
