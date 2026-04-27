/**
 * Phase 3.3.0 — Read-only dependency preview for company archive / safe delete.
 * No database writes. JSON output to stdout.
 *
 * Usage (from `apps/api` or repo root with `-w @captain/api`):
 *   npx tsx scripts/phase330-preview-company-delete-archive.ts
 *   npx tsx scripts/phase330-preview-company-delete-archive.ts <companyId>
 */
import "dotenv/config";
import { OrderStatus, Prisma, WalletOwnerType } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";

const ORDER_TERMINAL: OrderStatus[] = [OrderStatus.DELIVERED, OrderStatus.CANCELLED];

type RecommendedAction = "archive_company" | "manual_review" | "already_inactive";

type CompanyPreview = {
  companyId: string;
  companyName: string;
  isActive: boolean;
  /** Schema has `isActive` on Company; no `archivedAt` on companies table. */
  companyArchivedAt: null;
  usersCount: number;
  activeUsersCount: number;
  captainsCount: number;
  activeCaptainsCount: number;
  storesCount: number;
  ordersCount: number;
  activeNonTerminalOrdersCount: number;
  walletAccountsCount: number;
  ledgerEntriesCount: number;
  /** Activity where `user` belongs to this company (userId not null, user.companyId match). */
  activityLogsByCompanyUserCount: number;
  companyWalletBalanceSum: string;
  storeWalletsTotalBalanceSum: string;
  /** Sum of `Captain.prepaidBalance` for the company. */
  captainPrepaidBalanceTotal: string;
  canHardDelete: boolean;
  /** True if any data remains that blocks physical delete; Phase 3.3 uses soft archive only. */
  hardDeleteBlocked: boolean;
  recommendedAction: RecommendedAction;
  recommendedLabel: string;
  riskNotes: string[];
  /** High-level triage labels for Phase 3.3. */
  recommendationSummary: {
    path: RecommendedAction;
    hardDelete: "hard_delete_blocked" | "no_remaining_dependencies_in_preview";
  };
  schema: {
    companyHasIsActive: true;
    companyHasArchivedAt: false;
  };
};

function toDecimalString(v: Prisma.Decimal | null | undefined): string {
  if (v == null) return "0";
  return v.toString();
}

function buildRiskNotes(
  c: {
    isActive: boolean;
    usersCount: number;
    activeNonTerminalOrdersCount: number;
    ledgerEntriesCount: number;
    sumBalances: string;
  },
  activityLogsByCompanyUserCount: number,
): string[] {
  const notes: string[] = [
    "Soft archive only: no company row or ledger hard-delete in this phase (Phase 3.3).",
    "Activity log count is logs tied to a user in this company; null-user activity is excluded from this number.",
  ];
  if (c.activeNonTerminalOrdersCount > 0) {
    notes.push(
      `In-progress or non-terminal orders: ${c.activeNonTerminalOrdersCount} — block archive in production until orders complete or a future override (Phase 3.3+).`,
    );
  }
  if (c.ledgerEntriesCount > 0) {
    notes.push(`Append-only financial history: ${c.ledgerEntriesCount} ledger row(s) reference company wallets.`);
  }
  if (Number(c.sumBalances) !== 0) {
    notes.push("Non-zero wallet or captain balance totals: settle or transfer before decommission; verify numbers from finance.");
  }
  if (c.usersCount > 0) {
    notes.push(`User accounts: ${c.usersCount} (including inactive) will lose operational access when company is marked inactive, pending auth hardening.`);
  }
  if (activityLogsByCompanyUserCount > 0) {
    notes.push("Audit/activity data retained; Super Admin can still read history after archive.");
  }
  return notes;
}

async function loadCompany(companyId: string) {
  return prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, isActive: true },
  });
}

async function buildPreviewForCompany(companyId: string): Promise<CompanyPreview | { error: string; companyId: string }> {
  const comp = await loadCompany(companyId);
  if (!comp) {
    return { error: "NOT_FOUND", companyId };
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
    coWalletAgg,
    storeWalletAgg,
    captainPrepaidAgg,
  ] = await Promise.all([
    prisma.user.count({ where: { companyId } }),
    prisma.user.count({ where: { companyId, isActive: true } }),
    prisma.captain.count({ where: { companyId } }),
    prisma.captain.count({ where: { companyId, isActive: true } }),
    prisma.store.count({ where: { companyId } }),
    prisma.order.count({ where: { companyId } }),
    prisma.order.count({
      where: {
        companyId,
        archivedAt: null,
        status: { notIn: ORDER_TERMINAL },
      },
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
    prisma.captain.aggregate({
      where: { companyId },
      _sum: { prepaidBalance: true },
    }),
  ]);

  const companyWalletBalanceSum = toDecimalString(coWalletAgg._sum.balanceCached);
  const storeWalletsTotalBalanceSum = toDecimalString(storeWalletAgg._sum.balanceCached);
  const captainPrepaidBalanceTotal = toDecimalString(captainPrepaidAgg._sum.prepaidBalance);
  const sumBalancesNum = Number(companyWalletBalanceSum) + Number(storeWalletsTotalBalanceSum) + Number(captainPrepaidBalanceTotal);

  const hasDependencies =
    usersCount > 0 ||
    captainsCount > 0 ||
    storesCount > 0 ||
    ordersCount > 0 ||
    walletAccountsCount > 0 ||
    ledgerEntriesCount > 0 ||
    activityLogsByCompanyUserCount > 0;
  const canHardDelete = !hasDependencies;
  const hardDeleteBlocked = hasDependencies;
  const riskNotes = buildRiskNotes(
    {
      isActive: comp.isActive,
      usersCount,
      activeNonTerminalOrdersCount,
      ledgerEntriesCount,
      sumBalances: String(sumBalancesNum),
    },
    activityLogsByCompanyUserCount,
  );

  let recommendedAction: RecommendedAction;
  let recommendedLabel: string;
  if (!comp.isActive) {
    recommendedAction = "already_inactive";
    recommendedLabel =
      "Company is already soft-archived (isActive = false). Re-archive is idempotent. No `archivedAt` on companies table in current schema.";
  } else if (activeNonTerminalOrdersCount > 0) {
    recommendedAction = "manual_review";
    recommendedLabel =
      "Non-terminal / in-progress orders still present — block archive in production (Phase 3.3) until completed or a future override exists.";
  } else {
    recommendedAction = "archive_company";
    recommendedLabel =
      "Safe to plan soft archive: set isActive = false (with confirmation), no row deletion, no hard delete. Dependencies remain read-only in DB.";
  }

  const recommendationSummary: CompanyPreview["recommendationSummary"] = {
    path: recommendedAction,
    hardDelete: hardDeleteBlocked
      ? "hard_delete_blocked"
      : "no_remaining_dependencies_in_preview",
  };

  return {
    companyId: comp.id,
    companyName: comp.name,
    isActive: comp.isActive,
    companyArchivedAt: null,
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
    companyWalletBalanceSum,
    storeWalletsTotalBalanceSum,
    captainPrepaidBalanceTotal,
    canHardDelete,
    hardDeleteBlocked,
    recommendedAction,
    recommendedLabel,
    riskNotes,
    recommendationSummary,
    schema: {
      companyHasIsActive: true,
      companyHasArchivedAt: false,
    },
  };
}

async function main() {
  const companyArg = process.argv[2];
  const targets = companyArg
    ? [companyArg]
    : (await prisma.company.findMany({ select: { id: true }, orderBy: { name: "asc" } })).map((c) => c.id);

  const out: {
    generatedAt: string;
    phase: string;
    readOnly: true;
    noDbWrites: true;
    companyIdsRequested: string[];
    companies: Array<CompanyPreview | { error: string; companyId: string }>;
    globalSummary: {
      companyTableHasIsActive: true;
      companyTableHasArchivedAt: false;
      migrationNeededForCompanyArchive: false;
      reason: string;
    };
  } = {
    generatedAt: new Date().toISOString(),
    phase: "3.3.0",
    readOnly: true,
    noDbWrites: true,
    companyIdsRequested: targets,
    companies: [],
    globalSummary: {
      companyTableHasIsActive: true,
      companyTableHasArchivedAt: false,
      migrationNeededForCompanyArchive: false,
      reason: "Use existing `companies.is_active` for soft archive. Optional future `archived_at` is additive and not required for Phase 3.3.",
    },
  };

  for (const id of targets) {
    const row = await buildPreviewForCompany(id);
    out.companies.push(row);
  }

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(out, null, 2));
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
