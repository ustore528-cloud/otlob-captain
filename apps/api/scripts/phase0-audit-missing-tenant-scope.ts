/**
 * Phase 0 (read-only): audit accounts missing required tenant scope.
 * No writes, no behavior changes.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { PrismaClient, UserRole } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "..", ".env"), override: true });

const prisma = new PrismaClient();

type ScopeRow = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  role: UserRole;
  isActive: boolean;
  companyId: string | null;
  branchId: string | null;
  publicOwnerCode: string | null;
  createdAt: Date;
  updatedAt: Date;
};

async function main() {
  const rows = await prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      companyId: true,
      branchId: true,
      publicOwnerCode: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });

  const needsCompany = new Set<UserRole>([
    UserRole.COMPANY_ADMIN,
    UserRole.BRANCH_MANAGER,
    UserRole.DISPATCHER,
    UserRole.STORE_ADMIN,
    UserRole.STORE_USER,
    UserRole.CAPTAIN_SUPERVISOR,
  ]);
  const needsBranch = new Set<UserRole>([
    UserRole.BRANCH_MANAGER,
    UserRole.CAPTAIN_SUPERVISOR,
  ]);

  const missingCompany: ScopeRow[] = [];
  const missingBranch: ScopeRow[] = [];
  const storeRoleMissingStoreOwnership: Array<ScopeRow & { activeOwnedStoreCount: number }> = [];
  const captainRoleMissingCaptainProfile: Array<ScopeRow> = [];

  for (const row of rows) {
    if (needsCompany.has(row.role) && !row.companyId) missingCompany.push(row);
    if (needsBranch.has(row.role) && !row.branchId) missingBranch.push(row);
    if (row.role === UserRole.STORE_ADMIN || row.role === UserRole.STORE_USER) {
      const activeOwnedStoreCount = await prisma.store.count({
        where: { ownerUserId: row.id, isActive: true },
      });
      if (activeOwnedStoreCount === 0) {
        storeRoleMissingStoreOwnership.push({ ...row, activeOwnedStoreCount });
      }
    }
    if (row.role === UserRole.CAPTAIN) {
      const cap = await prisma.captain.findUnique({ where: { userId: row.id }, select: { id: true } });
      if (!cap) captainRoleMissingCaptainProfile.push(row);
    }
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    policy: {
      superAdminExempt: true,
      strictBlockingTargetAfterBackfill: true,
    },
    counts: {
      activeUsers: rows.length,
      missingCompanyScope: missingCompany.length,
      missingBranchScope: missingBranch.length,
      storeRoleMissingActiveOwnedStore: storeRoleMissingStoreOwnership.length,
      captainRoleMissingCaptainProfile: captainRoleMissingCaptainProfile.length,
    },
    details: {
      missingCompany,
      missingBranch,
      storeRoleMissingStoreOwnership,
      captainRoleMissingCaptainProfile,
    },
  };

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(payload, null, 2));
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
