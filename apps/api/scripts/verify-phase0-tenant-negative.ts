/**
 * Phase 0 negative verifier (expected to fail while issues exist).
 * This is intentionally strict to act as a QA gate before Phase 1.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { PrismaClient, UserRole } from "@prisma/client";
import { readFile } from "node:fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "..", ".env"), override: true });
const apiRoot = path.resolve(__dirname, "..");
const prisma = new PrismaClient();

async function main() {
  const activeUsers = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, role: true, companyId: true, branchId: true },
  });
  const needsCompany = new Set<UserRole>([
    UserRole.COMPANY_ADMIN,
    UserRole.BRANCH_MANAGER,
    UserRole.DISPATCHER,
    UserRole.STORE_ADMIN,
    UserRole.STORE_USER,
    UserRole.CAPTAIN_SUPERVISOR,
  ]);
  const needsBranch = new Set<UserRole>([UserRole.BRANCH_MANAGER, UserRole.CAPTAIN_SUPERVISOR]);
  const missingCompany = activeUsers.filter((u) => needsCompany.has(u.role) && !u.companyId).length;
  const missingBranch = activeUsers.filter((u) => needsBranch.has(u.role) && !u.branchId).length;

  const mismatchBranch = await prisma.$queryRaw<Array<{ c: bigint }>>`
    SELECT COUNT(*)::bigint AS c
    FROM orders o
    JOIN branches b ON b.id = o.branch_id
    WHERE o.archived_at IS NULL AND b.company_id IS DISTINCT FROM o.company_id
  `;
  const mismatchStoreCompany = await prisma.$queryRaw<Array<{ c: bigint }>>`
    SELECT COUNT(*)::bigint AS c
    FROM orders o
    JOIN stores s ON s.id = o.store_id
    WHERE o.archived_at IS NULL AND s.company_id IS DISTINCT FROM o.company_id
  `;

  const notificationsSvc = await readFile(
    path.resolve(apiRoot, "src/services/notifications.service.ts"),
    "utf8",
  );
  const hasLegacyGlobalQuickStatusPattern =
    notificationsSvc.includes("sendQuickStatusAlert") &&
    notificationsSvc.includes("prisma.captain.findMany") &&
    notificationsSvc.includes("where: { isActive: true, user: { isActive: true } }");
  const missingTenantScopeGuard =
    !notificationsSvc.includes("TENANT_SCOPE_REQUIRED") ||
    !notificationsSvc.includes("isSuperAdminRole") ||
    !notificationsSvc.includes("globalRequested");

  const failures = [
    { key: "missing_company_scope_users", count: missingCompany },
    { key: "missing_branch_scope_users", count: missingBranch },
    { key: "order_branch_cross_company_mismatch", count: Number(mismatchBranch[0]?.c ?? 0) },
    { key: "order_store_cross_company_mismatch", count: Number(mismatchStoreCompany[0]?.c ?? 0) },
    {
      key: "global_quick_status_fanout_pattern",
      count: hasLegacyGlobalQuickStatusPattern || missingTenantScopeGuard ? 1 : 0,
    },
  ];
  const failed = failures.filter((f) => f.count > 0);
  const payload = {
    generatedAt: new Date().toISOString(),
    failures,
    failedCount: failed.length,
    phase0GatePass: failed.length === 0,
    note: "Expected to fail before cleanup/hardening. Use this as a negative QA gate.",
  };

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(payload, null, 2));
  if (failed.length > 0) process.exitCode = 1;
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
