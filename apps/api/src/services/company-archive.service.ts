import { OrderStatus, Prisma, WalletOwnerType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/errors.js";

const ORDER_TERMINAL: OrderStatus[] = [OrderStatus.DELIVERED, OrderStatus.CANCELLED];
export const ARCHIVE_CONFIRMATION_PHRASE = "ARCHIVE COMPANY";

export type CompanyDeletePreview = {
  companyId: string;
  companyName: string;
  isActive: boolean;
  archivedAt: null;
  usersCount: number;
  activeUsersCount: number;
  captainsCount: number;
  activeCaptainsCount: number;
  storesCount: number;
  ordersCount: number;
  activeNonTerminalOrdersCount: number;
  walletAccountsCount: number;
  ledgerEntriesCount: number;
  activityLogsByCompanyUserCount: number;
  companyWalletBalance: string;
  storeBalancesTotal: string;
  captainPrepaidTotal: string;
  canHardDelete: boolean;
  recommendedAction: "archive_company" | "manual_review" | "already_inactive";
  riskNotes: string[];
};

function toDec(v: Prisma.Decimal | null | undefined): string {
  if (v == null) return "0";
  return v.toString();
}

function buildRiskNotes(
  c: { usersCount: number; activeNonTerminalOrdersCount: number; ledgerEntriesCount: number; sumBalances: string },
  activityCount: number,
): string[] {
  const out: string[] = [
    "Archiving sets company.isActive = false only; no rows are removed.",
    "Activity count includes only logs for users with this company set on their user record.",
  ];
  if (c.activeNonTerminalOrdersCount > 0) {
    out.push(
      `Non-terminal in-flight orders: ${c.activeNonTerminalOrdersCount} — archive is blocked until completed or a future override.`,
    );
  }
  if (c.ledgerEntriesCount > 0) {
    out.push(`${c.ledgerEntriesCount} ledger line(s) exist for this company's wallets.`);
  }
  if (Number(c.sumBalances) !== 0) {
    out.push("Non-zero balances on company/store/captain; verify with finance before decommissioning.");
  }
  if (c.usersCount > 0) {
    out.push(`${c.usersCount} user(s) are tied to this company.`);
  }
  if (activityCount > 0) {
    out.push("Activity history is retained; Super Admins can read after archive.");
  }
  return out;
}

export async function getCompanyDeletePreview(companyId: string): Promise<CompanyDeletePreview> {
  const comp = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, isActive: true },
  });
  if (!comp) {
    throw new AppError(404, "Company not found", "NOT_FOUND");
  }

  const [
    usersCount,
    activeUsersCount,
    captainsCount,
    activeCaptainsCount,
    storesCount,
    ordersCount,
    activeNonTerminalOrdersCount,
    walletAccountsCount,
    ledgerEntriesCount,
    activityLogsByCompanyUserCount,
    coW,
    stW,
    capSum,
  ] = await Promise.all([
    prisma.user.count({ where: { companyId } }),
    prisma.user.count({ where: { companyId, isActive: true } }),
    prisma.captain.count({ where: { companyId } }),
    prisma.captain.count({ where: { companyId, isActive: true } }),
    prisma.store.count({ where: { companyId } }),
    prisma.order.count({ where: { companyId } }),
    prisma.order.count({
      where: { companyId, archivedAt: null, status: { notIn: ORDER_TERMINAL } },
    }),
    prisma.walletAccount.count({ where: { companyId } }),
    prisma.ledgerEntry.count({ where: { walletAccount: { companyId } } }),
    prisma.activityLog.count({ where: { user: { companyId } } }),
    prisma.walletAccount.aggregate({
      where: { companyId, ownerType: WalletOwnerType.COMPANY },
      _sum: { balanceCached: true },
    }),
    prisma.walletAccount.aggregate({
      where: { companyId, ownerType: WalletOwnerType.STORE },
      _sum: { balanceCached: true },
    }),
    prisma.captain.aggregate({ where: { companyId }, _sum: { prepaidBalance: true } }),
  ]);

  const companyWalletBalance = toDec(coW._sum.balanceCached);
  const storeBalancesTotal = toDec(stW._sum.balanceCached);
  const captainPrepaidTotal = toDec(capSum._sum.prepaidBalance);
  const sumBalances = Number(companyWalletBalance) + Number(storeBalancesTotal) + Number(captainPrepaidTotal);

  const hasDependencies =
    usersCount > 0 ||
    captainsCount > 0 ||
    storesCount > 0 ||
    ordersCount > 0 ||
    walletAccountsCount > 0 ||
    ledgerEntriesCount > 0;

  const recommendedAction: CompanyDeletePreview["recommendedAction"] = !comp.isActive
    ? "already_inactive"
    : activeNonTerminalOrdersCount > 0
      ? "manual_review"
      : "archive_company";

  return {
    companyId: comp.id,
    companyName: comp.name,
    isActive: comp.isActive,
    archivedAt: null,
    usersCount,
    activeUsersCount,
    captainsCount,
    activeCaptainsCount,
    storesCount,
    ordersCount,
    activeNonTerminalOrdersCount,
    walletAccountsCount,
    ledgerEntriesCount,
    activityLogsByCompanyUserCount,
    companyWalletBalance,
    storeBalancesTotal,
    captainPrepaidTotal,
    canHardDelete: !hasDependencies,
    recommendedAction,
    riskNotes: buildRiskNotes(
      { usersCount, activeNonTerminalOrdersCount, ledgerEntriesCount, sumBalances: String(sumBalances) },
      activityLogsByCompanyUserCount,
    ),
  };
}

export type ArchiveCompanyResult = {
  companyId: string;
  companyName: string;
  isActive: boolean;
  alreadyArchived: boolean;
};

/**
 * Idempotent: if `isActive` is already false, returns without checking confirmation.
 * Otherwise requires `ARCHIVE COMPANY` and blocks on non-terminal orders.
 */
export async function archiveCompany(
  companyId: string,
  input: { confirmPhrase?: string | undefined },
): Promise<ArchiveCompanyResult> {
  const comp = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, isActive: true },
  });
  if (!comp) {
    throw new AppError(404, "Company not found", "NOT_FOUND");
  }
  if (!comp.isActive) {
    return {
      companyId: comp.id,
      companyName: comp.name,
      isActive: false,
      alreadyArchived: true,
    };
  }

  const phrase = (input.confirmPhrase ?? "").trim();
  if (phrase !== ARCHIVE_CONFIRMATION_PHRASE) {
    throw new AppError(400, "Invalid or missing confirmation phrase", "INVALID_ARCHIVE_CONFIRMATION");
  }

  const nonTerminal = await prisma.order.count({
    where: { companyId, archivedAt: null, status: { notIn: ORDER_TERMINAL } },
  });
  if (nonTerminal > 0) {
    throw new AppError(409, "Company has in-progress (non-terminal) orders", "COMPANY_HAS_ACTIVE_ORDERS", {
      count: nonTerminal,
    });
  }

  const updated = await prisma.company.update({
    where: { id: companyId },
    data: { isActive: false },
    select: { id: true, name: true, isActive: true },
  });
  return {
    companyId: updated.id,
    companyName: updated.name,
    isActive: updated.isActive,
    alreadyArchived: false,
  };
}
