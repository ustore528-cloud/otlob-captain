/**
 * Removes data created by verify-owner-isolation-qa.ts / verify-owner-isolation-http.ts.
 *
 * Safety:
 * - Only companies whose name is exactly "Ahmad Company QA" or "Mahmoud Company QA"
 *   AND whose fingerprint admin matches (phone + publicOwnerCode + COMPANY_ADMIN).
 * - If fingerprint fails for a name match, that company is SKIPPED with a warning (no blind delete).
 *
 * Usage:
 *   npx tsx apps/api/scripts/cleanup-owner-isolation-qa.ts --dry-run
 *   ALLOW_OWNER_ISOLATION_QA_CLEANUP=1 npx tsx apps/api/scripts/cleanup-owner-isolation-qa.ts --apply
 *
 * --apply requires env ALLOW_OWNER_ISOLATION_QA_CLEANUP=1 to reduce accidental runs against the wrong DB.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const QA_COMPANIES: Array<{ name: string; adminPhone: string; publicOwnerCode: string }> = [
  { name: "Ahmad Company QA", adminPhone: "+966501110001", publicOwnerCode: "CA-AHMAD" },
  { name: "Mahmoud Company QA", adminPhone: "+966501110002", publicOwnerCode: "CA-MAHMOUD" },
];

const QA_CAPTAIN_PHONES = ["+966501110011", "+966501110012"] as const;
const QA_ZONE_NAME = "القدس";

type ScopedCompany = { id: string; name: string };

function parseArgs(argv: string[]) {
  const dryRun = argv.includes("--dry-run");
  const apply = argv.includes("--apply");
  return { dryRun, apply };
}

async function resolveScopedCompanies(): Promise<{ scoped: ScopedCompany[]; skipped: string[] }> {
  const scoped: ScopedCompany[] = [];
  const skipped: string[] = [];

  for (const spec of QA_COMPANIES) {
    const company = await prisma.company.findFirst({
      where: { name: spec.name },
      select: { id: true, name: true },
    });
    if (!company) {
      skipped.push(`No company named exactly "${spec.name}" — nothing to do for this slot.`);
      continue;
    }
    const admin = await prisma.user.findFirst({
      where: {
        companyId: company.id,
        role: "COMPANY_ADMIN",
        phone: spec.adminPhone,
        publicOwnerCode: spec.publicOwnerCode,
      },
      select: { id: true },
    });
    if (!admin) {
      skipped.push(
        `Company "${spec.name}" (${company.id}) exists but fingerprint admin not found ` +
          `(expect phone ${spec.adminPhone}, code ${spec.publicOwnerCode}, COMPANY_ADMIN). Skipping — do not delete blindly.`,
      );
      continue;
    }
    scoped.push(company);
  }

  return { scoped, skipped };
}

type Plan = {
  scopedCompanies: ScopedCompany[];
  warnings: string[];
  companyIds: string[];
  userIds: string[];
  usersSummary: { id: string; phone: string | null; fullName: string; role: string }[];
  cityIds: string[];
  zoneIds: string[];
  zonesSummary: { id: string; name: string; cityId: string }[];
  branchIds: string[];
  branchesSummary: { id: string; name: string }[];
  storeIds: string[];
  storesSummary: { id: string; name: string; ownerUserId: string }[];
  captainIds: string[];
  captainsSummary: { id: string; userId: string; companyId: string }[];
  orderIds: string[];
  ordersSummary: { id: string; orderNumber: string; customerPhone: string; orderPublicOwnerCode: string | null }[];
  walletAccountIds: string[];
  walletsSummary: { id: string; ownerType: string; ownerId: string; companyId: string }[];
  ledgerEntryCount: number;
  captainBalanceTxCount: number;
  assignmentLogCount: number;
  captainLocationCount: number;
  activityLogCount: number;
  notificationCount: number;
  pushTokenCount: number;
  regionCount: number;
  deliverySettingsIds: string[];
  customerUserIdsFromOrders: string[];
  strayUsers: { id: string; phone: string; fullName: string; role: string }[];
};

async function buildPlan(companyIds: string[], warnings: string[]): Promise<Plan> {
  if (companyIds.length === 0) {
    return {
      scopedCompanies: [],
      warnings,
      companyIds: [],
      userIds: [],
      usersSummary: [],
      cityIds: [],
      zoneIds: [],
      zonesSummary: [],
      branchIds: [],
      branchesSummary: [],
      storeIds: [],
      storesSummary: [],
      captainIds: [],
      captainsSummary: [],
      orderIds: [],
      ordersSummary: [],
      walletAccountIds: [],
      walletsSummary: [],
      ledgerEntryCount: 0,
      captainBalanceTxCount: 0,
      assignmentLogCount: 0,
      captainLocationCount: 0,
      activityLogCount: 0,
      notificationCount: 0,
      pushTokenCount: 0,
      regionCount: 0,
      deliverySettingsIds: [],
      customerUserIdsFromOrders: [],
      strayUsers: [] as Plan["strayUsers"],
    };
  }

  const cities = await prisma.city.findMany({
    where: { companyId: { in: companyIds } },
    select: { id: true },
  });
  const cityIds = cities.map((c) => c.id);

  const zones = await prisma.zone.findMany({
    where: { cityId: { in: cityIds } },
    select: { id: true, name: true, cityId: true },
  });
  const zoneIds = zones.map((z) => z.id);
  const branches = await prisma.branch.findMany({
    where: { companyId: { in: companyIds } },
    select: { id: true, name: true },
  });
  const branchIds = branches.map((b) => b.id);

  const stores = await prisma.store.findMany({
    where: { companyId: { in: companyIds } },
    select: { id: true, name: true, ownerUserId: true },
  });
  const storeIds = stores.map((s) => s.id);

  const captains = await prisma.captain.findMany({
    where: { companyId: { in: companyIds } },
    select: { id: true, userId: true, companyId: true },
  });
  const captainIds = captains.map((c) => c.id);

  const captainUserIds = captains.map((c) => c.userId);
  const captainUsers = await prisma.user.findMany({
    where: { id: { in: captainUserIds } },
    select: { id: true, phone: true, fullName: true, role: true },
  });
  for (const u of captainUsers) {
    if (!QA_CAPTAIN_PHONES.includes(u.phone as (typeof QA_CAPTAIN_PHONES)[number])) {
      warnings.push(
        `Captain user ${u.id} (${u.phone}) is under a QA-scoped company but phone is not in QA captain list — ` +
          `still listed for removal as captain row is scoped to company; review before --apply.`,
      );
    }
  }

  const adminUsers = await prisma.user.findMany({
    where: {
      companyId: { in: companyIds },
      role: "COMPANY_ADMIN",
      OR: QA_COMPANIES.map((s) => ({ phone: s.adminPhone, publicOwnerCode: s.publicOwnerCode })),
    },
    select: { id: true, phone: true, fullName: true, role: true },
  });

  const userIdSet = new Set<string>();
  for (const u of adminUsers) userIdSet.add(u.id);
  for (const id of captainUserIds) userIdSet.add(id);
  const userIds = [...userIdSet];
  const usersSummary = [...adminUsers, ...captainUsers.filter((c) => !adminUsers.some((a) => a.id === c.id))];

  const orders = await prisma.order.findMany({
    where: { companyId: { in: companyIds } },
    select: {
      id: true,
      orderNumber: true,
      customerPhone: true,
      orderPublicOwnerCode: true,
      customerUserId: true,
    },
  });
  const orderIds = orders.map((o) => o.id);
  const customerUserIdsFromOrders = [
    ...new Set(orders.map((o) => o.customerUserId).filter((x): x is string => Boolean(x))),
  ];

  const wallets = await prisma.walletAccount.findMany({
    where: { companyId: { in: companyIds } },
    select: { id: true, ownerType: true, ownerId: true, companyId: true },
  });
  const walletAccountIds = wallets.map((w) => w.id);

  const ledgerEntryCount = await prisma.ledgerEntry.count({
    where: {
      OR: [
        { walletAccountId: { in: walletAccountIds } },
        { counterpartyAccountId: { in: walletAccountIds } },
        { orderId: { in: orderIds } },
      ],
    },
  });

  const captainBalanceTxCount = await prisma.captainBalanceTransaction.count({
    where: {
      OR: [{ captainId: { in: captainIds } }, { orderId: { in: orderIds } }],
    },
  });

  const assignmentLogCount = await prisma.orderAssignmentLog.count({
    where: { orderId: { in: orderIds } },
  });

  const captainLocationCount = await prisma.captainLocation.count({
    where: { captainId: { in: captainIds } },
  });

  const activityEntityIds = [...orderIds, ...storeIds, ...captainIds, ...userIds, ...companyIds];
  const activityEntityTypes = ["order", "store", "captain", "user", "company"] as const;

  const activityLogCount = await prisma.activityLog.count({
    where: {
      OR: [
        { userId: { in: userIds } },
        {
          entityType: { in: [...activityEntityTypes] },
          entityId: { in: activityEntityIds },
        },
      ],
    },
  });

  const strayUsers = await prisma.user.findMany({
    where: { companyId: { in: companyIds }, id: { notIn: userIds } },
    select: { id: true, phone: true, fullName: true, role: true },
  });
  if (strayUsers.length > 0) {
    warnings.push(
      `Found ${strayUsers.length} user(s) still linked to scoped companies but not in the QA admin/captain removal list — ` +
        `apply will abort unless resolved: ${JSON.stringify(strayUsers)}`,
    );
  }

  const notificationCount = await prisma.notification.count({
    where: { userId: { in: userIds } },
  });

  const pushTokenCount = await prisma.captainPushToken.count({
    where: { userId: { in: userIds } },
  });

  const regionCount = await prisma.region.count({
    where: { companyId: { in: companyIds } },
  });

  const deliverySettings = await prisma.deliverySettings.findMany({
    where: { companyId: { in: companyIds } },
    select: { id: true },
  });

  return {
    scopedCompanies: [],
    warnings,
    companyIds,
    userIds,
    usersSummary,
    cityIds,
    zoneIds,
    zonesSummary: zones,
    branchIds,
    branchesSummary: branches,
    storeIds,
    storesSummary: stores,
    captainIds,
    captainsSummary: captains,
    orderIds,
    ordersSummary: orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerPhone: o.customerPhone,
      orderPublicOwnerCode: o.orderPublicOwnerCode,
    })),
    walletAccountIds,
    walletsSummary: wallets,
    ledgerEntryCount,
    captainBalanceTxCount,
    assignmentLogCount,
    captainLocationCount,
    activityLogCount,
    notificationCount,
    pushTokenCount,
    regionCount,
    deliverySettingsIds: deliverySettings.map((d) => d.id),
    customerUserIdsFromOrders,
    strayUsers,
  };
}

function printDryRun(plan: Plan, scoped: ScopedCompany[]) {
  const out = {
    mode: "dry-run",
    scopedCompanies: scoped,
    skippedOrWarnings: plan.warnings,
    counts: {
      companies: plan.companyIds.length,
      users: plan.userIds.length,
      cities: plan.cityIds.length,
      zones: plan.zoneIds.length,
      zonesNamedAlQuds: plan.zonesSummary.filter((z) => z.name === QA_ZONE_NAME).length,
      branches: plan.branchIds.length,
      stores: plan.storeIds.length,
      captains: plan.captainIds.length,
      orders: plan.orderIds.length,
      walletAccounts: plan.walletAccountIds.length,
      ledgerEntries: plan.ledgerEntryCount,
      captainBalanceTransactions: plan.captainBalanceTxCount,
      orderAssignmentLogs: plan.assignmentLogCount,
      captainLocations: plan.captainLocationCount,
      activityLogs: plan.activityLogCount,
      notifications: plan.notificationCount,
      captainPushTokens: plan.pushTokenCount,
      regions: plan.regionCount,
      deliverySettings: plan.deliverySettingsIds.length,
    },
    usersToRemove: plan.usersSummary,
    companies: plan.companyIds,
    zones: plan.zonesSummary,
    branches: plan.branchesSummary,
    stores: plan.storesSummary,
    captains: plan.captainsSummary,
    orders: plan.ordersSummary,
    walletAccounts: plan.walletsSummary,
    customerUserIdsLinkedFromOrders: plan.customerUserIdsFromOrders,
    strayUsersBlockingApply: plan.strayUsers,
    note:
      "Customer users linked from orders are listed for review only; this script does not delete CUSTOMER users unless you extend it.",
  };
  // eslint-disable-next-line no-console -- CLI script
  console.log(JSON.stringify(out, null, 2));
}

async function applyPlan(plan: Plan): Promise<void> {
  if (plan.companyIds.length === 0) {
    // eslint-disable-next-line no-console -- CLI script
    console.log(JSON.stringify({ apply: true, message: "Nothing to delete." }, null, 2));
    return;
  }

  if (plan.strayUsers.length > 0) {
    throw new Error(
      "Aborting --apply: stray users still reference scoped companies. Remove or reassign them, then re-run dry-run.",
    );
  }

  const { companyIds, orderIds, captainIds, walletAccountIds, storeIds, userIds, branchIds, zoneIds, cityIds } = plan;
  const activityEntityIds = [...orderIds, ...storeIds, ...captainIds, ...userIds, ...companyIds];
  const activityEntityTypes = ["order", "store", "captain", "user", "company"];

  /** Railway / remote DB: default 5s interactive timeout is too low for this chain. */
  await prisma.$transaction(
    async (tx) => {
    await tx.ledgerEntry.deleteMany({
      where: {
        OR: [
          { walletAccountId: { in: walletAccountIds } },
          { counterpartyAccountId: { in: walletAccountIds } },
          { orderId: { in: orderIds } },
        ],
      },
    });

    await tx.captainBalanceTransaction.deleteMany({
      where: {
        OR: [{ captainId: { in: captainIds } }, { orderId: { in: orderIds } }],
      },
    });

    await tx.order.deleteMany({ where: { id: { in: orderIds } } });

    await tx.captainLocation.deleteMany({ where: { captainId: { in: captainIds } } });

    await tx.captain.deleteMany({ where: { id: { in: captainIds } } });

    await tx.activityLog.deleteMany({
      where: {
        OR: [
          { userId: { in: userIds } },
          {
            entityType: { in: activityEntityTypes },
            entityId: { in: activityEntityIds },
          },
        ],
      },
    });

    await tx.notification.deleteMany({ where: { userId: { in: userIds } } });
    await tx.captainPushToken.deleteMany({ where: { userId: { in: userIds } } });

    await tx.store.deleteMany({ where: { id: { in: storeIds } } });

    await tx.walletAccount.deleteMany({ where: { id: { in: walletAccountIds } } });

    await tx.user.deleteMany({ where: { id: { in: userIds } } });

    await tx.branch.deleteMany({ where: { id: { in: branchIds } } });

    await tx.zone.deleteMany({ where: { id: { in: zoneIds } } });

    await tx.city.deleteMany({ where: { id: { in: cityIds } } });

    await tx.region.deleteMany({ where: { companyId: { in: companyIds } } });

    await tx.company.deleteMany({ where: { id: { in: companyIds } } });
  },
    { maxWait: 30_000, timeout: 180_000 },
  );

  // eslint-disable-next-line no-console -- CLI script
  console.log(JSON.stringify({ apply: true, ok: true, deletedCompanyIds: companyIds }, null, 2));
}

async function main() {
  const argv = process.argv.slice(2);
  const { dryRun, apply } = parseArgs(argv);

  if ((!dryRun && !apply) || (dryRun && apply)) {
    throw new Error("Specify exactly one of: --dry-run | --apply");
  }

  const maskedUrl = process.env.DATABASE_URL
    ? process.env.DATABASE_URL.replace(/:([^:@/]+)@/, ":***@")
    : "(DATABASE_URL not set)";
  // eslint-disable-next-line no-console -- CLI script
  console.error(`[cleanup-owner-isolation-qa] DATABASE_URL (redacted): ${maskedUrl}`);

  const { scoped, skipped } = await resolveScopedCompanies();
  const warnings = [...skipped];

  const plan = await buildPlan(
    scoped.map((c) => c.id),
    warnings,
  );
  plan.scopedCompanies = scoped;

  if (dryRun) {
    printDryRun(plan, scoped);
    return;
  }

  if (process.env.ALLOW_OWNER_ISOLATION_QA_CLEANUP !== "1") {
    throw new Error(
      "Refusing --apply: set ALLOW_OWNER_ISOLATION_QA_CLEANUP=1 after reviewing --dry-run against the correct database.",
    );
  }

  await applyPlan(plan);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console -- CLI script
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
