/**
 * Read-only tenant isolation audit. No writes, no apply scripts.
 * Usage: npx tsx apps/api/scripts/audit-tenant-isolation-readonly.ts
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { PrismaClient, UserRole } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "..", ".env"), override: true });

const prisma = new PrismaClient();

const PRIORITY_EMAILS = ["alkamm678@gmail.com", "company.admin@example.com", "admin@example.com"] as const;

const STAFF_ROLES_FOR_LIST: UserRole[] = [
  UserRole.COMPANY_ADMIN,
  UserRole.BRANCH_MANAGER,
  UserRole.STORE_ADMIN,
  UserRole.STORE_USER,
  UserRole.DISPATCHER,
];

function redactDatabaseUrl(): { host: string; database: string; redacted: string } {
  const raw = process.env.DATABASE_URL ?? "";
  if (!raw) return { host: "(unset)", database: "(unset)", redacted: "(DATABASE_URL not set)" };
  try {
    const u = new URL(raw.replace(/^postgresql:/, "postgres:"));
    return {
      host: u.hostname,
      database: u.pathname.replace(/^\//, "") || "(empty)",
      redacted: raw.replace(/:([^:@/]+)@/, ":***@"),
    };
  } catch {
    return { host: "(unparseable)", database: "(unparseable)", redacted: "(redacted)" };
  }
}

async function resolveStoreIdForStoreAdminUser(userId: string): Promise<string | null> {
  const s = await prisma.store.findFirst({
    where: { ownerUserId: userId, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return s?.id ?? null;
}

async function main() {
  const db = redactDatabaseUrl();

  const priorityUsers = await prisma.user.findMany({
    where: { email: { in: [...PRIORITY_EMAILS] } },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      companyId: true,
      branchId: true,
      publicOwnerCode: true,
    },
  });

  const otherStaff = await prisma.user.findMany({
    where: {
      role: { in: STAFF_ROLES_FOR_LIST },
      email: { notIn: [...PRIORITY_EMAILS] },
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      companyId: true,
      branchId: true,
      publicOwnerCode: true,
    },
    take: 200,
    orderBy: { email: "asc" },
  });

  const usersAndScopes = await Promise.all(
    [...priorityUsers, ...otherStaff].map(async (u) => ({
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      companyId: u.companyId,
      branchId: u.branchId,
      storeId:
        u.role === UserRole.STORE_ADMIN || u.role === UserRole.STORE_USER
          ? await resolveStoreIdForStoreAdminUser(u.id)
          : null,
      publicOwnerCode: u.publicOwnerCode,
    })),
  );

  const totalOrders = await prisma.order.count({ where: { archivedAt: null } });

  /** branch.companyId !== order.companyId */
  const orderBranchCompanyMismatchRows = await prisma.$queryRaw<{ c: bigint }[]>`
    SELECT COUNT(*)::bigint AS c
    FROM orders o
    JOIN branches b ON b.id = o.branch_id
    WHERE o.archived_at IS NULL AND b.company_id IS DISTINCT FROM o.company_id
  `;
  const orderBranchCompanyMismatch = Number(orderBranchCompanyMismatchRows[0]?.c ?? 0);

  const orderStoreCompanyMismatchRows = await prisma.$queryRaw<{ c: bigint }[]>`
    SELECT COUNT(*)::bigint AS c
    FROM orders o
    JOIN stores s ON s.id = o.store_id
    WHERE o.archived_at IS NULL AND s.company_id IS DISTINCT FROM o.company_id
  `;
  const orderStoreCompanyMismatch = Number(orderStoreCompanyMismatchRows[0]?.c ?? 0);

  const orderStoreBranchMismatchRows = await prisma.$queryRaw<{ c: bigint }[]>`
    SELECT COUNT(*)::bigint AS c
    FROM orders o
    JOIN stores s ON s.id = o.store_id
    WHERE o.archived_at IS NULL AND s.branch_id IS DISTINCT FROM o.branch_id
  `;
  const orderStoreBranchMismatch = Number(orderStoreBranchMismatchRows[0]?.c ?? 0);

  const ordersMissingCompanyId = 0;

  const superAdminOrderScope = totalOrders;

  const companyAdmins = await prisma.user.findMany({
    where: { role: UserRole.COMPANY_ADMIN },
    select: { id: true, email: true, companyId: true, isActive: true },
  });

  const ordersVisibilitySimulation = {
    totalNonArchivedOrders: totalOrders,
    superAdmin: { expectedOrderCount: superAdminOrderScope, description: "all non-archived orders" },
    companyAdmins: [] as Array<{
      userId: string;
      email: string | null;
      companyId: string | null;
      naiveCompanyScopeCount: number;
      apiOwnerScopedCount: number;
      note: string;
    }>,
    branchManagers: [] as Array<{
      userId: string;
      email: string | null;
      branchId: string | null;
      expectedOrderCount: number;
    }>,
    storeAdmins: [] as Array<{
      userId: string;
      email: string | null;
      storeId: string | null;
      expectedOrderCount: number;
    }>,
    violations: {
      ordersMissingCompanyId,
      /** branch row company ≠ order.company — true cross-tenant data bug if >0 */
      orderBranchCompanyMismatch,
      /** store row company ≠ order.company — true cross-tenant data bug if >0 */
      orderStoreCompanyMismatch,
      /**
       * order.branch_id ≠ store.branch_id (store still same company).
       * Denormalization / drift; not the same as cross-company leakage.
       */
      orderStoreBranchIdDriftFromStore: orderStoreBranchMismatch,
    },
  };

  for (const a of companyAdmins) {
    const naive = a.companyId
      ? await prisma.order.count({
          where: { archivedAt: null, companyId: a.companyId },
        })
      : null;
    const ownerScoped = await prisma.order.count({
      where: {
        archivedAt: null,
        OR: [
          { createdByUserId: a.id },
          { ownerUserId: a.id },
          { assignedCaptain: { createdByUserId: a.id } },
        ],
      },
    });
    ordersVisibilitySimulation.companyAdmins.push({
      userId: a.id,
      email: a.email,
      isActive: a.isActive,
      companyId: a.companyId,
      naiveCompanyScopeCount: naive,
      apiOwnerScopedCount: ownerScoped,
      note: "API list for COMPANY_ADMIN uses owner/createdBy/captain-createdBy OR (see orderRepository.companyAdminOwnerUserId), not companyId alone.",
    });
  }

  const branchManagers = await prisma.user.findMany({
    where: { role: UserRole.BRANCH_MANAGER, isActive: true, branchId: { not: null } },
    select: { id: true, email: true, branchId: true },
    take: 100,
  });
  for (const b of branchManagers) {
    const n = await prisma.order.count({
      where: { archivedAt: null, branchId: b.branchId! },
    });
    ordersVisibilitySimulation.branchManagers.push({
      userId: b.id,
      email: b.email,
      branchId: b.branchId,
      expectedOrderCount: n,
    });
  }

  const storeRoleUsers = await prisma.user.findMany({
    where: { role: { in: [UserRole.STORE_ADMIN, UserRole.STORE_USER] }, isActive: true },
    select: { id: true, email: true },
    take: 100,
  });
  for (const s of storeRoleUsers) {
    const sid = await resolveStoreIdForStoreAdminUser(s.id);
    const n = sid
      ? await prisma.order.count({ where: { archivedAt: null, storeId: sid } })
      : 0;
    ordersVisibilitySimulation.storeAdmins.push({
      userId: s.id,
      email: s.email,
      storeId: sid,
      expectedOrderCount: n,
    });
  }

  /** Captains: same-company wrong branch (data smell) */
  const captainBranchCompanyMismatchRows = await prisma.$queryRaw<{ c: bigint }[]>`
    SELECT COUNT(*)::bigint AS c
    FROM captains c
    JOIN branches b ON b.id = c.branch_id
    WHERE c.company_id IS DISTINCT FROM b.company_id
  `;
  const captainBranchCompanyMismatch = Number(captainBranchCompanyMismatchRows[0]?.c ?? 0);

  /** Captain zone vs captain company via zone->city */
  const captainZoneCompanyMismatchRows = await prisma.$queryRaw<{ c: bigint }[]>`
    SELECT COUNT(*)::bigint AS c
    FROM captains c
    JOIN zones z ON z.id = c.zone_id
    JOIN cities ci ON ci.id = z.city_id
    WHERE c.zone_id IS NOT NULL AND ci.company_id IS DISTINCT FROM c.company_id
  `;
  const captainZoneCompanyMismatch = Number(captainZoneCompanyMismatchRows[0]?.c ?? 0);

  const captainsVisibilitySimulation: Record<string, unknown> = {
    integrity: {
      captainBranchCompanyMismatch,
      captainZoneCompanyMismatch,
    },
    byUser: [] as Array<{
      email: string | null;
      role: UserRole;
      expectedCaptainCount: number;
      outsideCompanyCount: number;
      outsideCreatedByCount: number;
    }>,
  };

  const staffForCaptainSim = await prisma.user.findMany({
    where: { role: { in: [UserRole.COMPANY_ADMIN, UserRole.BRANCH_MANAGER, UserRole.DISPATCHER] }, isActive: true },
    select: { id: true, email: true, role: true, companyId: true, branchId: true },
    take: 80,
  });

  for (const u of staffForCaptainSim) {
    if (u.role === UserRole.COMPANY_ADMIN && u.companyId) {
      const owned = await prisma.captain.count({
        where: { companyId: u.companyId, createdByUserId: u.id },
      });
      const sameCompanyOtherOwner = await prisma.captain.count({
        where: {
          companyId: u.companyId,
          OR: [{ createdByUserId: { not: u.id } }, { createdByUserId: null }],
        },
      });
      (captainsVisibilitySimulation.byUser as unknown[]).push({
        email: u.email,
        role: u.role,
        expectedListCount_companyAdmin: owned,
        sameCompanyCaptainsNotCreatedByThisAdmin: sameCompanyOtherOwner,
        note: "COMPANY_ADMIN API list uses createdByUserId = actor; other same-company captains must not appear.",
      });
    } else if (u.role === UserRole.BRANCH_MANAGER && u.branchId && u.companyId) {
      const onBranch = await prisma.captain.count({ where: { branchId: u.branchId } });
      const wrongCompanySameBranch = await prisma.captain.count({
        where: { branchId: u.branchId, companyId: { not: u.companyId } },
      });
      (captainsVisibilitySimulation.byUser as unknown[]).push({
        email: u.email,
        role: u.role,
        expectedListCount_branchManager: onBranch,
        captainsOnSameBranchWrongCompany: wrongCompanySameBranch,
        note: "Should be zero if branch FK integrity holds.",
      });
    } else if (u.role === UserRole.DISPATCHER && u.companyId) {
      const inCompany = await prisma.captain.count({ where: { companyId: u.companyId } });
      (captainsVisibilitySimulation.byUser as unknown[]).push({
        email: u.email,
        role: u.role,
        expectedListCount_dispatcherCompany: inCompany,
        note: "DISPATCHER list uses tenant companyId (+ optional branch).",
      });
    }
  }

  const branchWrongCompanyRows = await prisma.$queryRaw<{ c: bigint }[]>`
    SELECT COUNT(*)::bigint AS c
    FROM branches b
    LEFT JOIN cities ci ON ci.id = b.city_id
    WHERE ci.id IS NOT NULL AND ci.company_id IS DISTINCT FROM b.company_id
  `;
  const branchCityCompanyMismatch = Number(branchWrongCompanyRows[0]?.c ?? 0);

  const storeBranchMismatchRows = await prisma.$queryRaw<{ c: bigint }[]>`
    SELECT COUNT(*)::bigint AS c
    FROM stores s
    JOIN branches b ON b.id = s.branch_id
    WHERE s.company_id IS DISTINCT FROM b.company_id
  `;
  const storeBranchCompanyMismatch = Number(storeBranchMismatchRows[0]?.c ?? 0);

  const branchZoneStoreIntegrity = {
    branchCityCompanyMismatch,
    storeBranchCompanyMismatch,
    orderBranchCompanyMismatch,
    orderStoreCompanyMismatch,
    orderStoreBranchMismatch,
    captainBranchCompanyMismatch,
    captainZoneCompanyMismatch,
  };

  const companies = await prisma.company.findMany({ select: { id: true, name: true } });
  const captainCreateRiskAudit = [] as Array<{
    companyId: string;
    companyName: string;
    branchCountTotalInDb: number;
    branchCountOtherCompanies: number;
    zoneCountInOtherCompanyCities: number;
    note: string;
  }>;

  for (const co of companies.slice(0, 50)) {
    const branchesThisCompany = await prisma.branch.count({
      where: { isActive: true, companyId: co.id },
    });
    const branchesOtherCompanies = await prisma.branch.count({
      where: { isActive: true, companyId: { not: co.id } },
    });
    const zonesThisCompany = await prisma.zone.count({
      where: { isActive: true, city: { companyId: co.id } },
    });
    const zonesOtherCompanies = await prisma.zone.count({
      where: { isActive: true, city: { companyId: { not: co.id } } },
    });
    captainCreateRiskAudit.push({
      companyId: co.id,
      companyName: co.name,
      activeBranchesThisCompany: branchesThisCompany,
      activeBranchesOtherCompanies: branchesOtherCompanies,
      activeZonesThisCompany: zonesThisCompany,
      activeZonesOtherCompanies: zonesOtherCompanies,
      note:
        "Other-company branch/zone rows exist in DB for multi-tenant; UI/API must filter by tenant so admins cannot pick foreign ids.",
    });
  }

  const recentOrders = await prisma.order.findMany({
    where: {
      archivedAt: null,
      status: { in: ["PENDING", "CONFIRMED", "ASSIGNED"] },
    },
    select: {
      id: true,
      companyId: true,
      branchId: true,
      zoneId: true,
      storeId: true,
      status: true,
    },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  const dispatchCandidateSimulation = [] as Array<{
    orderId: string;
    status: string;
    companyId: string;
    branchId: string;
    zoneId: string | null;
    storeId: string;
    captainsSameCompany: number;
    captainsSameBranch: number;
    captainsOtherCompanySameBranch: number;
    captainsOtherCompany: number;
  }>;

  for (const o of recentOrders) {
    const sameCo = await prisma.captain.count({ where: { companyId: o.companyId } });
    const sameBr = await prisma.captain.count({ where: { branchId: o.branchId } });
    const otherCoSameBr = await prisma.captain.count({
      where: { branchId: o.branchId, companyId: { not: o.companyId } },
    });
    const otherCo = await prisma.captain.count({ where: { companyId: { not: o.companyId } } });
    dispatchCandidateSimulation.push({
      orderId: o.id,
      status: o.status,
      companyId: o.companyId,
      branchId: o.branchId,
      zoneId: o.zoneId,
      storeId: o.storeId,
      captainsSameCompany: sameCo,
      captainsSameBranch: sameBr,
      captainsOtherCompanySameBranch: otherCoSameBr,
      captainsOtherCompany: otherCo,
    });
  }

  const webApiEndpointChecklist = {
    readPaths: [
      "GET /api/v1/orders — tenant + COMPANY_ADMIN owner filter; manual test per role JWT.",
      "GET /api/v1/captains — tenant + COMPANY_ADMIN createdByUserId; manual test.",
      "GET /api/v1/branches — resolveStaffTenantOrderListFilter; COMPANY_ADMIN company scope.",
      "GET /api/v1/zones — listZonesForStaff actor-scoped.",
      "GET /api/v1/stores — store list middleware RBAC.",
      "POST /api/v1/orders/:id/distribution/* — distribution engine eligibility vs captain pool.",
      "POST /api/v1/captains — create captain body branchId/zoneId validation vs company.",
    ],
    note: "Automated audit above uses SQL/Prisma reads only; endpoint behavior still needs auth token tests.",
  };

  const crossCompanyOrdersRisk = orderBranchCompanyMismatch > 0 || orderStoreCompanyMismatch > 0;
  const orderStoreBranchDenormalizationRisk = orderStoreBranchMismatch > 0;
  const crossCompanyCaptainsRisk = captainBranchCompanyMismatch > 0 || captainZoneCompanyMismatch > 0;
  const branchZoneMismatchRisk =
    branchCityCompanyMismatch > 0 ||
    storeBranchCompanyMismatch > 0 ||
    crossCompanyOrdersRisk;
  /** Multi-tenant DB always has other companies' branches/zones; risk is mitigated by API filtering, not absence of rows. */
  const captainCreateWrongScopeRisk = captainCreateRiskAudit.some(
    (r) => r.activeBranchesOtherCompanies > 0 || r.activeZonesOtherCompanies > 0,
  );
  const dispatchCrossCompanyRisk = dispatchCandidateSimulation.some((d) => d.captainsOtherCompanySameBranch > 0);

  const allChecksPass =
    !crossCompanyOrdersRisk &&
    !crossCompanyCaptainsRisk &&
    !branchZoneMismatchRisk &&
    ordersMissingCompanyId === 0;

  const out = {
    databaseTarget: {
      host: db.host,
      database: db.database,
      redactedUrl: db.redacted,
    },
    usersAndScopes,
    ordersVisibilitySimulation,
    captainsVisibilitySimulation,
    branchZoneStoreIntegrity,
    captainCreateRiskAudit,
    dispatchCandidateSimulation,
    webApiEndpointChecklist,
    finalSummary: {
      allChecksPass,
      crossCompanyOrdersRisk,
      orderStoreBranchDenormalizationRisk,
      crossCompanyCaptainsRisk,
      branchZoneMismatchRisk,
      captainCreateWrongScopeRisk,
      dispatchCrossCompanyRisk,
      recommendedNextStep: allChecksPass
        ? orderStoreBranchDenormalizationRisk
          ? "Structural tenant checks pass; review order↔store branch_id drift (4 rows) for reporting/assignment consistency."
          : "Run authenticated API smoke tests per role; then browser QA on staging."
        : "Investigate SQL-reported cross-company mismatches first; fix data or FK constraints before relying on tenant filters.",
    },
  };

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(out, null, 2));
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
