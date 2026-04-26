/**
 * Remove or soft-disable data created by the 2-role RBAC runtime verification (local/staging),
 * using explicit patterns only — no broad deletes.
 *
 * Usage:
 *   npx tsx apps/api/scripts/cleanup-rbac-qa-data.ts --dry-run
 *   npx tsx apps/api/scripts/cleanup-rbac-qa-data.ts --apply
 */
import "dotenv/config";
import { Prisma, WalletOwnerType } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";

const isDryRun = process.argv.includes("--dry-run");
const isApply = process.argv.includes("--apply");

if (isDryRun && isApply) {
  // eslint-disable-next-line no-console
  console.error("Use either --dry-run or --apply, not both.");
  process.exit(1);
}
if (!isDryRun && !isApply) {
  // eslint-disable-next-line no-console
  console.error("Pass --dry-run or --apply.");
  process.exit(1);
}

/** Known QA seeds from tmp-rbac-two-role-verify.ts */
const QA_USER_PHONES = ["+966500001111", "+966500001112", "+966500001113"] as const;
const QA_USER_EMAILS = [
  "qa-super-admin@example.com",
  "qa-company-admin-a@example.com",
  "qa-company-admin-b@example.com",
] as const;
const QA_USER_FULLNAMES = ["QA Super Admin", "QA Company Admin A", "QA Company Admin B"] as const;
const QA_COMPANY_NAMES = ["QA Company A", "QA Company B"] as const;
const QA_STORE_NAMES = ["QA Store A", "QA Store B"] as const;
const QA_CAPTAIN_USER_NAMES = ["QA Captain A1", "QA Captain B1"] as const;
const QA_ORDER_NUMBER_PREFIXES = ["QA-A-", "QA-B-"] as const;
/** Substrings in `CaptainBalanceTransaction.note` from the runtime charge test (strict). */
const QA_CHARGE_NOTE_SUBSTR = ["QA own charge", "QA unrelated charge"] as const;
const QA_BRANCH_NAME_PREFIX = "QA Branch";

type Bundle = {
  companyIds: string[];
  branchIds: string[];
  storeIds: string[];
  orderIds: string[];
  captainUserIds: string[];
  captainIds: string[];
  platformUserIds: string[];
  otherUserIds: string[];
  walletAccountIds: string[];
  ledgerEntryIds: string[];
  balanceTxIds: string[];
  activityLogIds: string[];
  notificationIds: string[];
};

function noteLooksQa(note: string | null | undefined): boolean {
  if (!note) return false;
  return QA_CHARGE_NOTE_SUBSTR.some((s) => note.includes(s));
}

async function discover(): Promise<Bundle> {
  const platformUsers = await prisma.user.findMany({
    where: {
      OR: [
        { phone: { in: [...QA_USER_PHONES] } },
        { email: { in: [...QA_USER_EMAILS] } },
        { fullName: { in: [...QA_USER_FULLNAMES] } },
      ],
    },
    select: { id: true, fullName: true, email: true, phone: true, role: true },
  });
  const platformUserIds = platformUsers.map((u) => u.id);

  const companies = await prisma.company.findMany({
    where: { name: { in: [...QA_COMPANY_NAMES] } },
    select: { id: true, name: true },
  });
  const companyIds = companies.map((c) => c.id);

  const branches = await prisma.branch.findMany({
    where: {
      companyId: { in: companyIds },
      name: { startsWith: QA_BRANCH_NAME_PREFIX },
    },
    select: { id: true, name: true, companyId: true },
  });
  const branchIds = branches.map((b) => b.id);

  const storeRows = await prisma.store.findMany({
    where: {
      name: { in: [...QA_STORE_NAMES] },
      companyId: { in: companyIds },
    },
    select: { id: true, name: true, ownerUserId: true },
  });
  const storeIds = storeRows.map((s) => s.id);

  const captainWhere: Prisma.CaptainWhereInput = {
    user: { fullName: { in: [...QA_CAPTAIN_USER_NAMES] } },
    ...(companyIds.length ? { companyId: { in: companyIds } } : {}),
  };
  const captains = await prisma.captain.findMany({
    where: captainWhere,
    select: { id: true, userId: true, createdByUserId: true },
  });

  const captainIds = captains.map((c) => c.id);
  const captainUserIds = captains.map((c) => c.userId);

  const orderWhere: Prisma.OrderWhereInput = {
    AND: [
      { OR: QA_ORDER_NUMBER_PREFIXES.map((p) => ({ orderNumber: { startsWith: p } })) },
      ...(companyIds.length > 0 ? [{ companyId: { in: companyIds } }] : []),
    ],
  };
  const orders = await prisma.order.findMany({
    where: orderWhere,
    select: { id: true, orderNumber: true, companyId: true, storeId: true },
  });
  const orderIds = orders.map((o) => o.id);

  const allCaptainTxs =
    captainIds.length === 0
      ? []
      : await prisma.captainBalanceTransaction.findMany({
          where: { captainId: { in: captainIds } },
          select: { id: true, captainId: true, note: true, type: true, amount: true, createdAt: true },
        });
  const balanceTxsFinal = allCaptainTxs.filter((t) => noteLooksQa(t.note));

  const wallRows =
    captainIds.length === 0
      ? []
      : await prisma.walletAccount.findMany({
          where: { ownerType: WalletOwnerType.CAPTAIN, ownerId: { in: captainIds } },
          select: { id: true, ownerId: true, companyId: true },
        });
  /** Company-scoped wallets for the named QA companies only (enables `company` delete if ledgers are cleared). */
  const companyWallets =
    companyIds.length === 0
      ? []
      : await prisma.walletAccount.findMany({
          where: { companyId: { in: companyIds } },
          select: { id: true, ownerType: true, ownerId: true, companyId: true },
        });
  const walletAccountIds = [...new Set([...wallRows.map((w) => w.id), ...companyWallets.map((w) => w.id)])];

  const ledgerByWallet =
    walletAccountIds.length === 0
      ? []
      : await prisma.ledgerEntry.findMany({
          where: { walletAccountId: { in: walletAccountIds } },
          select: { id: true, entryType: true, amount: true, orderId: true, createdAt: true },
        });
  const ledgerByOrder =
    orderIds.length === 0
      ? []
      : await prisma.ledgerEntry.findMany({
          where: { orderId: { in: orderIds } },
          select: { id: true, entryType: true, amount: true, orderId: true, createdAt: true },
        });
  const ledgerEntryIds = [
    ...new Set([...ledgerByWallet.map((e) => e.id), ...ledgerByOrder.map((e) => e.id)]),
  ];

  const entityIdSet = new Set<string>([...captainIds, ...orderIds, ...storeIds, ...companyIds, ...branchIds]);
  const userIdSet = new Set<string>([...platformUserIds, ...captainUserIds]);

  const actLogs1 =
    userIdSet.size === 0
      ? []
      : await prisma.activityLog.findMany({
          where: { userId: { in: [...userIdSet] } },
          select: { id: true, action: true, entityType: true, entityId: true, userId: true, createdAt: true },
        });
  const actLogs2 =
    entityIdSet.size === 0
      ? []
      : await prisma.activityLog.findMany({
          where: { entityId: { in: [...entityIdSet] } },
          select: { id: true, action: true, entityType: true, entityId: true, userId: true, createdAt: true },
        });
  const activityLogIds = [...new Set([...actLogs1.map((a) => a.id), ...actLogs2.map((a) => a.id)])];

  const notifIds =
    userIdSet.size === 0
      ? []
      : (await prisma.notification.findMany({ where: { userId: { in: [...userIdSet] } }, select: { id: true } })).map(
          (n) => n.id,
        );

  const otherUserIds: string[] = [];
  for (const s of storeRows) {
    if (s.ownerUserId && !platformUserIds.includes(s.ownerUserId) && !captainUserIds.includes(s.ownerUserId)) {
      otherUserIds.push(s.ownerUserId);
    }
  }

  return {
    companyIds,
    branchIds,
    storeIds,
    orderIds,
    captainUserIds,
    captainIds,
    platformUserIds,
    otherUserIds: [...new Set(otherUserIds)],
    walletAccountIds,
    ledgerEntryIds,
    balanceTxIds: balanceTxsFinal.map((b) => b.id),
    activityLogIds,
    notificationIds: notifIds,
  };
}

async function applyDelete(bundle: Bundle) {
  await prisma.$transaction(
    async (tx) => {
      if (bundle.activityLogIds.length) {
        await tx.activityLog.deleteMany({ where: { id: { in: bundle.activityLogIds } } });
      }
      if (bundle.notificationIds.length) {
        await tx.notification.deleteMany({ where: { id: { in: bundle.notificationIds } } });
      }
      if (bundle.ledgerEntryIds.length) {
        await tx.ledgerEntry.deleteMany({ where: { id: { in: bundle.ledgerEntryIds } } });
      }
      if (bundle.walletAccountIds.length) {
        await tx.walletAccount.deleteMany({ where: { id: { in: bundle.walletAccountIds } } });
      }
      if (bundle.orderIds.length) {
        await tx.order.deleteMany({ where: { id: { in: bundle.orderIds } } });
      }
      if (bundle.storeIds.length) {
        await tx.store.deleteMany({ where: { id: { in: bundle.storeIds } } });
      }
      for (const uid of bundle.captainUserIds) {
        await tx.user.delete({ where: { id: uid } }).catch(() => undefined);
      }
      for (const uid of bundle.platformUserIds) {
        await tx.user.delete({ where: { id: uid } }).catch(() => undefined);
      }
      if (bundle.branchIds.length) {
        await tx.branch.deleteMany({ where: { id: { in: bundle.branchIds } } });
      }
      if (bundle.companyIds.length) {
        for (const cid of bundle.companyIds) {
          await tx.deliverySettings.deleteMany({ where: { companyId: cid } });
          await tx.company.delete({ where: { id: cid } }).catch(() => undefined);
        }
      }
    },
    { maxWait: 30_000, timeout: 120_000 },
  );
}

async function main() {
  const meta = { dryRun: isDryRun, apply: isApply, at: new Date().toISOString() };
  // eslint-disable-next-line no-console
  console.log("[cleanup-rbac-qa-data] start", meta);

  const before = await discover();

  const platformUsers = await prisma.user.findMany({
    where: { id: { in: before.platformUserIds } },
    select: { id: true, fullName: true, email: true, phone: true, role: true, isActive: true, createdAt: true },
  });
  const captainUsers = await prisma.user.findMany({
    where: { id: { in: before.captainUserIds } },
    select: { id: true, fullName: true, phone: true, createdAt: true },
  });
  const companies = await prisma.company.findMany({ where: { id: { in: before.companyIds } } });
  const branches = await prisma.branch.findMany({ where: { id: { in: before.branchIds } } });
  const stores = await prisma.store.findMany({ where: { id: { in: before.storeIds } } });
  const orders = await prisma.order.findMany({ where: { id: { in: before.orderIds } } });
  const capRows = await prisma.captain.findMany({
    where: { id: { in: before.captainIds } },
    select: {
      id: true,
      createdByUserId: true,
      prepaidBalance: true,
      createdAt: true,
    },
  });
  const balTxs =
    before.captainIds.length === 0
      ? []
      : await prisma.captainBalanceTransaction.findMany({
          where: { captainId: { in: before.captainIds } },
        });
  const balTxQa = balTxs.filter((t) => noteLooksQa(t.note));
  const ledger = await prisma.ledgerEntry.findMany({ where: { id: { in: before.ledgerEntryIds } } });
  const activities = await prisma.activityLog.findMany({ where: { id: { in: before.activityLogIds } } });
  const pushCount =
    before.captainUserIds.length === 0
      ? 0
      : await prisma.captainPushToken.count({ where: { userId: { in: before.captainUserIds } } });

  const out = {
    usersToRemoveOrDisable: {
      count: platformUsers.length + captainUsers.length,
      platformUsers,
      captainUsers,
    },
    captainsToRemove: { count: capRows.length, rows: capRows },
    storesToRemove: { count: stores.length, names: stores.map((s) => ({ id: s.id, name: s.name })) },
    ordersToRemove: {
      count: orders.length,
      orderNumbers: orders.map((o) => ({ id: o.id, orderNumber: o.orderNumber, archivedAt: o.archivedAt })),
    },
    walletAndLedger: {
      balanceTransactionsMatchingQaNote: { count: balTxQa.length, rows: balTxQa },
      allBalanceTransactionsOnQaCaptains: { count: balTxs.length, noteSample: balTxs.slice(0, 5).map((b) => b.note) },
      ledgerEntries: { count: ledger.length, entryTypes: [...new Set(ledger.map((e) => e.entryType))] },
      walletAccountIds: before.walletAccountIds,
    },
    activityAndAudit: {
      activityLogs: { count: activities.length, sample: activities.slice(0, 15) },
    },
    companiesAndBranches: { companies, branches },
    other: { pushTokensToCascadeWithCaptainUsers: pushCount },
    idSummary: {
      companyIds: before.companyIds,
      balanceTxNoteFilterCount: balTxQa.length,
    },
  };

  // eslint-disable-next-line no-console
  console.log("[cleanup-rbac-qa-data] dry-run", JSON.stringify(out, replacer, 2));

  if (isApply) {
    if (before.companyIds.length === 0 && before.platformUserIds.length === 0) {
      // eslint-disable-next-line no-console
      console.log("[cleanup-rbac-qa-data] apply skipped: no QA rows matched (safety).");
      return;
    }
    // Rebuild bundle with strict balance tx list for any post-discovery logic
    const bundle: Bundle = {
      ...before,
      balanceTxIds: balTxQa.map((b) => b.id),
    };
    // CaptainBalanceTransaction and locations cascade on User (captain) delete
    void bundle.balanceTxIds; // not deleted separately; cascade from captain user delete
    await applyDelete(bundle);
    // eslint-disable-next-line no-console
    console.log("[cleanup-rbac-qa-data] apply finished.");
  } else {
    // eslint-disable-next-line no-console
    console.log("[cleanup-rbac-qa-data] (dry-run only) No database changes were made.");
  }
}

function replacer(_: string, v: unknown) {
  if (v instanceof Prisma.Decimal) {
    return v.toString();
  }
  return v;
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
