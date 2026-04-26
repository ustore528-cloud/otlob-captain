/**
 * Phase 2.3 — Company Admin read-only company wallet balance verification.
 * Run: `npm run phase23:verify-company-admin-company-wallet-read` from `apps/api`
 */
import "dotenv/config";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { UserRole, type WalletOwnerType } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";
import {
  assertCanReadCompanyWallet,
  companyWalletService,
  type CompanyWalletActor,
} from "../src/services/company-wallet.service.js";
import { AppError } from "../src/utils/errors.js";
import { ROLE_GROUPS } from "../src/lib/rbac-roles.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "..");

type Check = { id: string; pass: boolean; details?: unknown };

function assertCode(e: unknown, code: string): void {
  if (!(e instanceof AppError) || e.code !== code) {
    throw e instanceof Error ? e : new Error(String(e));
  }
}

function actor(
  u: { id: string; role: UserRole; companyId: string | null; branchId: string | null },
): CompanyWalletActor {
  return { userId: u.id, role: u.role, companyId: u.companyId, branchId: u.branchId };
}

async function countWalletsByOwner(): Promise<Record<string, number>> {
  const rows = await prisma.walletAccount.groupBy({
    by: ["ownerType"],
    _count: { _all: true },
  });
  const out: Record<string, number> = {};
  for (const r of rows) {
    out[r.ownerType] = r._count._all;
  }
  return out;
}

async function main() {
  const checks: Check[] = [];
  const beforeCounts = await countWalletsByOwner();

  const sa = await prisma.user.findFirst({ where: { isActive: true, role: UserRole.SUPER_ADMIN } });
  if (!sa) {
    throw new Error("No active SUPER_ADMIN in DB");
  }
  const ca = await prisma.user.findFirst({
    where: { isActive: true, role: UserRole.COMPANY_ADMIN, companyId: { not: null } },
  });
  if (!ca?.companyId) {
    throw new Error("No active COMPANY_ADMIN with companyId in DB");
  }
  const otherCo = await prisma.company.findFirst({
    where: { isActive: true, id: { not: ca.companyId } },
  });
  if (!otherCo) {
    throw new Error("Need at least two active companies in DB to verify cross-tenant read denial.");
  }

  // 1 — Company admin reads own
  const meRead = await companyWalletService.getCompanyWalletReadMe(actor(ca));
  checks.push({
    id: "company_admin_read_own",
    pass: meRead.companyId === ca.companyId && meRead.walletId.length > 0,
    details: { companyId: meRead.companyId, balance: meRead.balance },
  });

  // 2 — cannot assert read of another company
  try {
    assertCanReadCompanyWallet(actor(ca), otherCo.id);
    checks.push({ id: "company_admin_cannot_read_other", pass: false });
  } catch (e) {
    assertCode(e, "FORBIDDEN");
    checks.push({ id: "company_admin_cannot_read_other", pass: true });
  }

  // 3 — cannot top up company wallet
  try {
    await companyWalletService.superAdminTopUpCompanyWallet(actor(ca), {
      companyId: ca.companyId,
      amount: "1.00",
      idempotencyKey: `p23-cannot-${Date.now()}`,
      reason: "must fail",
    });
    checks.push({ id: "company_admin_cannot_topup", pass: false });
  } catch (e) {
    assertCode(e, "FORBIDDEN");
    checks.push({ id: "company_admin_cannot_topup", pass: true });
  }

  // 4 — Super admin read by id
  const byId = await companyWalletService.getCompanyWalletReadById(actor(sa), meRead.companyId);
  checks.push({
    id: "super_admin_read_any",
    pass: byId.companyId === meRead.companyId && byId.walletId === meRead.walletId,
  });

  // 5 — no companyId on company admin
  try {
    await companyWalletService.getCompanyWalletReadMe({
      userId: ca.id,
      role: UserRole.COMPANY_ADMIN,
      companyId: null,
      branchId: null,
    });
    checks.push({ id: "missing_scope_tenant_required", pass: false });
  } catch (e) {
    assertCode(e, "TENANT_SCOPE_REQUIRED");
    checks.push({ id: "missing_scope_tenant_required", pass: true });
  }

  // 5b — getCompanyWalletReadById with company admin blocked
  try {
    await companyWalletService.getCompanyWalletReadById(actor(ca), meRead.companyId);
    checks.push({ id: "by_id_not_for_company_admin", pass: false });
  } catch (e) {
    assertCode(e, "FORBIDDEN");
    checks.push({ id: "by_id_not_for_company_admin", pass: true });
  }

  // 5c — getCompanyWalletReadMe for super admin should redirect code
  try {
    await companyWalletService.getCompanyWalletReadMe(actor(sa));
    checks.push({ id: "me_not_for_super_admin", pass: false });
  } catch (e) {
    assertCode(e, "COMPANY_WALLET_USE_PATH");
    checks.push({ id: "me_not_for_super_admin", pass: true });
  }

  // 6 — super-admin-wallets: only super admins on router
  const rPath = path.join(apiRoot, "src/routes/v1/super-admin-wallets.routes.ts");
  const rSrc = await readFile(rPath, "utf8");
  const usesSuper = rSrc.includes("requireRoles(...ROLE_GROUPS.superAdmins)");
  const companyTopLine = rSrc
    .split("\n")
    .find((l) => l.includes("company/") && l.includes("top-up"));
  checks.push({
    id: "phase22_topup_route_super_only",
    pass: usesSuper && rSrc.includes("/company/:companyId/top-up"),
    details: { requireSuperAdmins: usesSuper, sample: companyTopLine?.trim() },
  });

  // 7
  const v = spawnSync("npm run verify:phase0:tenant-negative", {
    cwd: apiRoot,
    shell: true,
    encoding: "utf8",
  });
  checks.push({
    id: "verify_phase0",
    pass: v.status === 0,
    details: { exitCode: v.status },
  });

  // 8
  const afterCounts = await countWalletsByOwner();
  const watch: WalletOwnerType[] = ["STORE", "CAPTAIN", "SUPERVISOR_USER"];
  let okCounts = true;
  for (const ot of watch) {
    if ((beforeCounts[ot] ?? 0) !== (afterCounts[ot] ?? 0)) {
      okCounts = false;
    }
  }
  checks.push({
    id: "other_wallet_types_unchanged",
    pass: okCounts,
    details: { before: beforeCounts, after: afterCounts, watch },
  });

  // ROLE_GROUPS.superAdmins is only SUPER_ADMIN
  const saOnly = ROLE_GROUPS.superAdmins.length === 1 && ROLE_GROUPS.superAdmins[0] === "SUPER_ADMIN";
  checks.push({
    id: "role_group_super_admins_is_super_only",
    pass: saOnly,
    details: { roles: [...ROLE_GROUPS.superAdmins] },
  });

  const failed = checks.filter((c) => !c.pass);
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        phase: "2.3",
        totalChecks: checks.length,
        failedChecks: failed.length,
        checks,
        cleanupStatus: { note: "Read-only; no data mutations." },
      },
      null,
      2,
    ),
  );
  if (failed.length) {
    process.exit(1);
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
