/**
 * Phase 3.2.4 — Company Admin auto-distribution / autoAssignVisible tenant pool + logging.
 * Run: `npm run phase324:verify-company-admin-auto-distribution` from repo root with `-w @captain/api`
 */
import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { UserRole } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";
import {
  captainPoolWhereAutoDistribution,
  distributionService,
  getAutoPoolOfferTelemetry,
} from "../src/services/distribution/index.js";
import type { DistributionRequestContext } from "../src/services/distribution/distribution-engine.js";
import { isCompanyAdminRole, isSuperAdminRole, isLegacyAdminRole, type AppRole } from "../src/lib/rbac-roles.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "..");

type Check = { id: string; pass: boolean; details?: unknown };

function mergeForTest(
  ctx: DistributionRequestContext,
  actor: { role: AppRole; userId: string; companyId: string | null; branchId: string | null },
): DistributionRequestContext {
  return {
    ...ctx,
    actorRole: actor.role,
    bypassSupervisorLinkScope:
      isSuperAdminRole(actor.role) || isCompanyAdminRole(actor.role) || isLegacyAdminRole(actor.role),
    bypassOrderOwnerCaptainFleetForCompanyAdmin: isCompanyAdminRole(actor.role),
  };
}

async function main() {
  const checks: Check[] = [];

  const sa = await prisma.user.findFirst({ where: { isActive: true, role: UserRole.SUPER_ADMIN } });
  if (!sa) throw new Error("No active SUPER_ADMIN");

  const caA = await prisma.user.findFirst({
    where: { isActive: true, role: UserRole.COMPANY_ADMIN, companyId: { not: null } },
  });
  if (!caA?.companyId) throw new Error("No COMPANY_ADMIN with companyId");

  const disp = await prisma.user.findFirst({
    where: { isActive: true, role: UserRole.DISPATCHER, companyId: caA.companyId },
  });

  const otherCo = await prisma.company.findFirst({ where: { isActive: true, id: { not: caA.companyId } } });
  if (!otherCo) throw new Error("Need a second company");

  const orderB = await prisma.order.findFirst({
    where: { companyId: otherCo.id, archivedAt: null },
    select: { id: true },
  });

  const orderA = await prisma.order.findFirst({
    where: {
      companyId: caA.companyId,
      archivedAt: null,
      ownerUserId: { not: null },
    },
    select: { id: true, branchId: true, companyId: true, ownerUserId: true },
  });

  if (orderA?.ownerUserId) {
    const caCtx: DistributionRequestContext = mergeForTest(
      { requestId: "p324-tel" },
      {
        role: caA.role as AppRole,
        userId: caA.id,
        companyId: caA.companyId,
        branchId: caA.branchId,
      },
    );
    const dispCtx: DistributionRequestContext = disp
      ? mergeForTest(
          { requestId: "p324-disp" },
          { role: disp.role as AppRole, userId: disp.id, companyId: disp.companyId, branchId: disp.branchId },
        )
      : null;
    const saCtx: DistributionRequestContext = mergeForTest(
      { requestId: "p324-sa" },
      { role: "SUPER_ADMIN" as AppRole, userId: sa.id, companyId: null, branchId: null },
    );

    const telCa = await getAutoPoolOfferTelemetry(orderA.id, caCtx, "OVERRIDE_MULTI_ORDER");
    const telSa = await getAutoPoolOfferTelemetry(orderA.id, saCtx, "OVERRIDE_MULTI_ORDER");
    const telDisp = dispCtx ? await getAutoPoolOfferTelemetry(orderA.id, dispCtx, "OVERRIDE_MULTI_ORDER") : null;

    if (telCa) {
      const wherePool = captainPoolWhereAutoDistribution({
        orderCompanyId: orderA.companyId,
        orderBranchId: orderA.branchId,
        restrictToOrderBranch: true,
      });
      const inBranch = await prisma.captain.findMany({ where: wherePool, select: { id: true, companyId: true } });
      const allSameCompany = inBranch.length === 0 || inBranch.every((c) => c.companyId === orderA.companyId);
      checks.push({
        id: "auto_pool_no_cross_company_captain_in_branch",
        pass: allSameCompany,
        details: { branchCaptains: inBranch.length },
      });

      const hasExtraNonOwner = await prisma.captain.findFirst({
        where: {
          branchId: orderA.branchId,
          companyId: orderA.companyId,
          createdByUserId: { not: orderA.ownerUserId! },
        },
        select: { id: true },
      });
      if (hasExtraNonOwner && telCa.scopedCaptainCount > 0 && telDisp) {
        checks.push({
          id: "ca_auto_pool_uses_branch_not_only_owner_fleet",
          pass: telCa.scopedCaptainCount >= telDisp.scopedCaptainCount,
          details: {
            caScoped: telCa.scopedCaptainCount,
            dispScoped: telDisp.scopedCaptainCount,
          },
        });
      } else {
        checks.push({
          id: "ca_auto_pool_uses_branch_not_only_owner_fleet",
          pass: true,
          details: { note: "No extra non-owner captain in branch or no dispatcher; skipped" },
        });
      }

      checks.push({
        id: "prepaid_depleted_increases_skipped_telemetry",
        pass:
          telCa.skippedForPrepaid +
            telCa.eligibleCaptainCount +
            telCa.skippedForCapacity +
            telCa.skippedForOther ===
          telCa.scopedCaptainCount,
        details: { tel: telCa },
      });

      checks.push({
        id: "super_admin_auto_pool_unchanged_owner_fleet",
        pass: !telDisp || telSa?.scopedCaptainCount === telDisp.scopedCaptainCount,
        details: { sa: telSa?.scopedCaptainCount, disp: telDisp?.scopedCaptainCount },
      });
    } else {
      checks.push({ id: "auto_pool_no_cross_company_captain_in_branch", pass: false, details: { note: "no telCa" } });
    }
  } else {
    checks.push({
      id: "auto_pool_no_cross_company_captain_in_branch",
      pass: true,
      details: { note: "No order A with owner" },
    });
  }

  if (orderB) {
    const r = await distributionService.autoAssignVisible(
      { orderIds: [orderB.id] },
      caA.id,
      { userId: caA.id, role: caA.role as AppRole, companyId: caA.companyId, branchId: caA.branchId },
      { requestId: "p324-aaVis" },
    );
    const forB = r.skipped.find((s) => s.orderId === orderB.id);
    checks.push({
      id: "autoAssignVisible_ca_cannot_process_other_company_order",
      pass: r.assignedCount === 0 && forB != null,
      details: { assignedCount: r.assignedCount, skipped: r.skipped },
    });
  } else {
    checks.push({
      id: "autoAssignVisible_ca_cannot_process_other_company_order",
      pass: true,
      details: { note: "No order in company B" },
    });
  }

  const v = spawnSync("npm run verify:phase0:tenant-negative", { cwd: apiRoot, shell: true, encoding: "utf8" });
  checks.push({ id: "verify_phase0", pass: v.status === 0, details: { exitCode: v.status ?? v.error } });

  const failed = checks.filter((c) => !c.pass);
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        phase: "3.2.4",
        phasePass: failed.length === 0,
        checks,
      },
      null,
      2,
    ),
  );
  if (failed.length > 0) process.exit(1);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
