import { LedgerEntryType, Prisma, type WalletAccount, WalletOwnerType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/errors.js";
import { isCompanyAdminRole, isSuperAdminRole, type AppRole } from "../lib/rbac-roles.js";
import { appendLedgerEntryInTx } from "./ledger/append-ledger-entry.js";
import { ensureWalletAccountInTx } from "./ledger/ensure-wallet.js";
import { money, ZERO } from "./ledger/money.js";

const LEDGER_TX = {
  maxWait: 10_000,
  timeout: 30_000,
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
} as const;

export type CompanyWalletActor = {
  userId: string;
  role: AppRole;
  companyId: string | null;
  branchId: string | null;
};

export type CompanyWalletBalanceDto = {
  walletAccountId: string;
  companyId: string;
  ownerType: WalletOwnerType;
  ownerId: string;
  balanceCached: string;
  currency: string;
};

export type SuperAdminCompanyTopUpResult = {
  companyId: string;
  walletId: string;
  balanceBefore: string;
  balanceAfter: string;
  ledgerEntryId: string;
  idempotencyKey: string;
  idempotent: boolean;
};

export type CompanyWalletLedgerSummaryLine = {
  id: string;
  entryType: string;
  amount: string;
  currency: string;
  createdAt: string;
  idempotencyKey: string | null;
};

export type CompanyWalletReadDto = {
  companyId: string;
  walletId: string;
  balance: string;
  currency: string;
  updatedAt: string;
  recentLedger: CompanyWalletLedgerSummaryLine[];
};

const COMPANY_OWNER_TYPE = "COMPANY" as unknown as WalletOwnerType;

export async function assertCompanyWalletTarget(companyId: string): Promise<void> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, isActive: true },
  });
  if (!company) {
    throw new AppError(404, "Company not found", "COMPANY_NOT_FOUND");
  }
  if (!company.isActive) {
    throw new AppError(400, "Company is inactive", "COMPANY_INACTIVE");
  }
}

export function assertCanReadCompanyWallet(actor: CompanyWalletActor, companyId: string): void {
  if (isSuperAdminRole(actor.role)) return;
  if (isCompanyAdminRole(actor.role)) {
    if (!actor.companyId) {
      throw new AppError(
        403,
        "Company scope is required on your account for this operation.",
        "TENANT_SCOPE_REQUIRED",
      );
    }
    if (actor.companyId !== companyId) {
      throw new AppError(403, "Forbidden", "FORBIDDEN");
    }
    return;
  }
  throw new AppError(403, "Forbidden", "FORBIDDEN");
}

export function assertCanTopUpCompanyWallet(actor: CompanyWalletActor, companyId: string): void {
  if (isSuperAdminRole(actor.role)) return;
  if (isCompanyAdminRole(actor.role)) {
    if (!actor.companyId) {
      throw new AppError(
        403,
        "Company scope is required on your account for this operation.",
        "TENANT_SCOPE_REQUIRED",
      );
    }
    if (actor.companyId === companyId) {
      throw new AppError(403, "Company admin cannot top up company wallet", "FORBIDDEN");
    }
  }
  throw new AppError(403, "Forbidden", "FORBIDDEN");
}

async function resolveTargetCompanyId(actor: CompanyWalletActor, companyId?: string): Promise<string> {
  if (isSuperAdminRole(actor.role)) {
    if (!companyId) {
      throw new AppError(400, "companyId is required for super admin company wallet actions", "BAD_REQUEST");
    }
    return companyId;
  }
  if (!actor.companyId) {
    throw new AppError(
      403,
      "Company scope is required on your account for this operation.",
      "TENANT_SCOPE_REQUIRED",
    );
  }
  return actor.companyId;
}

export async function getOrCreateCompanyWallet(
  companyId: string,
  tx?: Prisma.TransactionClient,
): Promise<WalletAccount> {
  if (!tx) {
    return prisma.$transaction((trx) => getOrCreateCompanyWallet(companyId, trx));
  }
  await assertCompanyWalletTarget(companyId);
  return ensureWalletAccountInTx(tx, {
    ownerType: COMPANY_OWNER_TYPE,
    ownerId: companyId,
    companyId,
  });
}

export async function getCompanyWalletBalance(
  actor: CompanyWalletActor,
  companyId?: string,
): Promise<CompanyWalletBalanceDto> {
  const targetCompanyId = await resolveTargetCompanyId(actor, companyId);
  await assertCompanyWalletTarget(targetCompanyId);
  assertCanReadCompanyWallet(actor, targetCompanyId);

  const wallet = await getOrCreateCompanyWallet(targetCompanyId);
  return {
    walletAccountId: wallet.id,
    companyId: wallet.companyId,
    ownerType: wallet.ownerType,
    ownerId: wallet.ownerId,
    balanceCached: money(wallet.balanceCached).toFixed(2),
    currency: wallet.currency,
  };
}

const SA_COMPANY_IDEM_PREFIX = "sa-topup:company";

function buildCompanyTopUpIdempotencyKey(companyId: string, clientKey: string): string {
  return `${SA_COMPANY_IDEM_PREFIX}:${companyId}:${clientKey.trim()}`;
}

/**
 * Super Admin only. Credits the company `WalletAccount` (COMPANY owner) and appends a `SUPER_ADMIN_TOP_UP` ledger line.
 * Idempotency is enforced via the composed key `sa-topup:company:{companyId}:{clientIdempotencyKey}`.
 */
export async function superAdminTopUpCompanyWallet(
  actor: CompanyWalletActor,
  input: {
    companyId: string;
    amount: Prisma.Decimal | string | number;
    idempotencyKey: string;
    reason: string;
    currency?: string;
  },
): Promise<SuperAdminCompanyTopUpResult> {
  if (!isSuperAdminRole(actor.role)) {
    throw new AppError(403, "Forbidden", "FORBIDDEN");
  }
  if (typeof input.idempotencyKey !== "string" || input.idempotencyKey.trim() === "") {
    throw new AppError(400, "idempotencyKey is required", "IDEMPOTENCY_KEY_REQUIRED");
  }
  const reason = input.reason?.trim() ?? "";
  if (reason.length === 0) {
    throw new AppError(400, "Reason is required", "REASON_REQUIRED");
  }
  const amount = money(input.amount);
  if (!amount.gt(ZERO)) {
    throw new AppError(400, "Amount must be positive", "LEDGER_AMOUNT_INVALID");
  }
  const clientKey = input.idempotencyKey.trim();
  const idem = buildCompanyTopUpIdempotencyKey(input.companyId, clientKey);

  return prisma.$transaction(async (tx) => {
    const wallet = await getOrCreateCompanyWallet(input.companyId, tx);
    const balanceBefore = money(wallet.balanceCached).toFixed(2);
    const r = await appendLedgerEntryInTx(tx, {
      walletAccountId: wallet.id,
      entryType: LedgerEntryType.SUPER_ADMIN_TOP_UP,
      amount,
      idempotencyKey: idem,
      currency: input.currency,
      createdByUserId: actor.userId,
      referenceType: "COMPANY",
      referenceId: input.companyId,
      metadata: { reason, source: "super_admin_company_wallet_topup" },
    });
    return {
      companyId: input.companyId,
      walletId: r.account.id,
      balanceBefore,
      balanceAfter: money(r.account.balanceCached).toFixed(2),
      ledgerEntryId: r.entry.id,
      idempotencyKey: clientKey,
      idempotent: r.idempotent,
    };
  }, LEDGER_TX);
}

async function buildCompanyWalletReadDto(
  actor: CompanyWalletActor,
  companyId: string,
): Promise<CompanyWalletReadDto> {
  await assertCompanyWalletTarget(companyId);
  assertCanReadCompanyWallet(actor, companyId);
  const wallet = await getOrCreateCompanyWallet(companyId);
  const recent = await prisma.ledgerEntry.findMany({
    where: { walletAccountId: wallet.id },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      entryType: true,
      amount: true,
      currency: true,
      createdAt: true,
      idempotencyKey: true,
    },
  });
  return {
    companyId: wallet.companyId,
    walletId: wallet.id,
    balance: money(wallet.balanceCached).toFixed(2),
    currency: wallet.currency,
    updatedAt: wallet.updatedAt.toISOString(),
    recentLedger: recent.map((e) => ({
      id: e.id,
      entryType: e.entryType,
      amount: money(e.amount).toFixed(2),
      currency: e.currency,
      createdAt: e.createdAt.toISOString(),
      idempotencyKey: e.idempotencyKey,
    })),
  };
}

/**
 * `GET /finance/company-wallet/me` — `COMPANY_ADMIN` only; always uses `actor.companyId` (no client `companyId`).
 * Super admin must use `getCompanyWalletReadById` instead.
 */
export async function getCompanyWalletReadMe(actor: CompanyWalletActor): Promise<CompanyWalletReadDto> {
  if (isSuperAdminRole(actor.role)) {
    throw new AppError(
      400,
      "As super admin, use GET /api/v1/finance/company-wallet/:companyId to read a company wallet balance.",
      "COMPANY_WALLET_USE_PATH",
    );
  }
  if (!isCompanyAdminRole(actor.role)) {
    throw new AppError(403, "Forbidden", "FORBIDDEN");
  }
  if (!actor.companyId) {
    throw new AppError(
      403,
      "Company scope is required on your account for this operation.",
      "TENANT_SCOPE_REQUIRED",
    );
  }
  return buildCompanyWalletReadDto(actor, actor.companyId);
}

/**
 * `GET /finance/company-wallet/:companyId` — `SUPER_ADMIN` only.
 */
export async function getCompanyWalletReadById(
  actor: CompanyWalletActor,
  companyId: string,
): Promise<CompanyWalletReadDto> {
  if (!isSuperAdminRole(actor.role)) {
    throw new AppError(403, "Forbidden", "FORBIDDEN");
  }
  return buildCompanyWalletReadDto(actor, companyId);
}

export const companyWalletService = {
  getOrCreateCompanyWallet,
  getCompanyWalletBalance,
  assertCanReadCompanyWallet,
  assertCanTopUpCompanyWallet,
  assertCompanyWalletTarget,
  superAdminTopUpCompanyWallet,
  getCompanyWalletReadMe,
  getCompanyWalletReadById,
};
