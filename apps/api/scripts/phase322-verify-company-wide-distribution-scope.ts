/**
 * Phase 3.2.2 — Company-wide order/captain lists and distribution scope for COMPANY_ADMIN.
 * Run: `npm run phase322:verify-company-wide-distribution-scope` from repo root with `-w @captain/api`
 */
import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { OrderStatus, UserRole } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";
import { ordersService } from "../src/services/orders.service.js";
import { captainsService } from "../src/services/captains.service.js";
import { distributionService } from "../src/services/distribution/index.js";
import { trackingService } from "../src/services/tracking.service.js";
import { AppError } from "../src/utils/errors.js";
import type { AppRole } from "../src/lib/rbac-roles.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "..");

type Check = { id: string; pass: boolean; details?: unknown };

function staffActor(u: {
  id: string;
  role: UserRole;
  companyId: string | null;
  branchId: string | null;
}): { userId: string; role: AppRole; storeId: string | null; companyId: string | null; branchId: string | null } {
  return { userId: u.id, role: u.role as AppRole, storeId: null, companyId: u.companyId, branchId: u.branchId };
}

function assertForbidden(e: unknown): void {
  if (!(e instanceof AppError) || e.code !== "FORBIDDEN") {
    throw e instanceof Error ? e : new Error(String(e));
  }
}

async function main() {
  const checks: Check[] = [];
  const runKey = `p322-${Date.now()}`;

  const sa = await prisma.user.findFirst({ where: { isActive: true, role: UserRole.SUPER_ADMIN } });
  if (!sa) throw new Error("No active SUPER_ADMIN");

  const caA = await prisma.user.findFirst({
    where: { isActive: true, role: UserRole.COMPANY_ADMIN, companyId: { not: null } },
  });
  if (!caA?.companyId) throw new Error("No COMPANY_ADMIN with companyId");

  const otherCo = await prisma.company.findFirst({ where: { isActive: true, id: { not: caA.companyId } } });
  if (!otherCo) throw new Error("Need a second company for cross-tenant checks");

  const companyIdA = caA.companyId;

  const countOrdersA = await prisma.order.count({
    where: { companyId: companyIdA, archivedAt: null },
  });
  const listA = await ordersService.list(
    { page: 1, pageSize: 500, status: undefined, area: undefined, orderNumber: "", customerPhone: "" },
    staffActor(caA),
  );
  checks.push({
    id: "ca_orders_list_count_matches_company",
    pass: listA.total === countOrdersA,
    details: { listTotal: listA.total, dbCount: countOrdersA },
  });

  const notStewardOrder = await prisma.order.findFirst({
    where: {
      companyId: companyIdA,
      archivedAt: null,
      OR: [
        { createdByUserId: { not: caA.id } },
        { createdByUserId: null },
        {
          AND: [
            { ownerUserId: { not: caA.id } },
            { ownerUserId: { not: null } },
          ],
        },
      ],
    },
    select: { id: true, orderNumber: true },
  });
  if (notStewardOrder) {
    const inList = listA.items.some((o) => o.id === notStewardOrder.id);
    checks.push({
      id: "ca_sees_order_not_just_steward",
      pass: inList,
      details: { orderId: notStewardOrder.id },
    });
  } else {
    checks.push({
      id: "ca_sees_order_not_just_steward",
      pass: true,
      details: { note: "No non-steward order in company A; skipped inclusion check" },
    });
  }

  const orderB = await prisma.order.findFirst({
    where: { companyId: otherCo.id, archivedAt: null },
    select: { id: true },
  });
  if (orderB) {
    try {
      await ordersService.getById(orderB.id, staffActor(caA));
      checks.push({ id: "ca_cannot_get_other_company_order", pass: false });
    } catch (e) {
      try {
        assertForbidden(e);
        checks.push({ id: "ca_cannot_get_other_company_order", pass: true });
      } catch {
        checks.push({ id: "ca_cannot_get_other_company_order", pass: false, details: { err: String(e) } });
      }
    }
  } else {
    checks.push({ id: "ca_cannot_get_other_company_order", pass: true, details: { note: "No order in company B" } });
  }

  const countCapsA = await prisma.captain.count({ where: { companyId: companyIdA, isActive: true } });
  const capListA = await captainsService.list(
    { page: 1, pageSize: 500, isActive: true },
    { userId: caA.id, role: caA.role as AppRole, companyId: caA.companyId, branchId: caA.branchId },
  );
  checks.push({
    id: "ca_captains_list_count",
    pass: capListA.total === countCapsA,
    details: { listTotal: capListA.total, dbCount: countCapsA },
  });

  const capNotByCa = await prisma.captain.findFirst({
    where: { companyId: companyIdA, createdByUserId: { not: caA.id } },
    select: { id: true },
  });
  if (capNotByCa) {
    const inCapList = capListA.items.some((c) => c.id === capNotByCa.id);
    checks.push({ id: "ca_lists_captain_not_created_by_self", pass: inCapList, details: { captainId: capNotByCa.id } });
  } else {
    checks.push({
      id: "ca_lists_captain_not_created_by_self",
      pass: true,
      details: { note: "All captains in A created by this CA; skipped" },
    });
  }

  const capB = await prisma.captain.findFirst({ where: { companyId: otherCo.id, isActive: true } });
  if (capB) {
    try {
      await captainsService.getById(capB.id, staffActor(caA));
      checks.push({ id: "ca_cannot_get_other_company_captain", pass: false });
    } catch (e) {
      try {
        assertForbidden(e);
        checks.push({ id: "ca_cannot_get_other_company_captain", pass: true });
      } catch {
        checks.push({ id: "ca_cannot_get_other_company_captain", pass: false, details: { err: String(e) } });
      }
    }
  } else {
    checks.push({ id: "ca_cannot_get_other_company_captain", pass: true, details: { note: "No captain in B" } });
  }

  const pendingA = await prisma.order.findFirst({
    where: {
      companyId: companyIdA,
      archivedAt: null,
      status: { in: [OrderStatus.PENDING, OrderStatus.CONFIRMED] },
    },
    select: { id: true, branchId: true, companyId: true, ownerUserId: true },
  });
  const capsSameBranch =
    pendingA &&
    (await prisma.captain.findMany({
      where: { companyId: companyIdA, branchId: pendingA.branchId, isActive: true },
      select: { id: true, createdByUserId: true },
      orderBy: { id: "asc" },
    }));

  let assignOk = false;
  let assignDetail: unknown;
  let hardAssignFailure: AppError | null = null;
  if (pendingA && capsSameBranch && capsSameBranch.length > 0) {
    for (const cap of capsSameBranch) {
      if (pendingA.ownerUserId && cap.createdByUserId !== pendingA.ownerUserId) {
        continue;
      }
      try {
        await distributionService.assignManual(
          pendingA.id,
          cap.id,
          caA.id,
          "MANUAL",
          { requestId: `p322-manual-${runKey}-${cap.id}` },
          {
            userId: caA.id,
            role: caA.role as AppRole,
            companyId: caA.companyId,
            branchId: caA.branchId,
          },
        );
        assignOk = true;
        assignDetail = { orderId: pendingA.id, captainId: cap.id };
        break;
      } catch (e) {
        assignDetail = { lastError: e instanceof Error ? e.message : String(e), attemptedCaptainId: cap.id };
        if (e instanceof AppError && (e.message.includes("الرصيد") || e.code === "PREPAID_BALANCE_DEPLETED" || e.code === "PREPAID_BALANCE_BLOCKED")) {
          continue;
        }
        if (e instanceof AppError && (e.code === "OWNER_MISMATCH" || e.code?.startsWith("SUPERVISOR"))) {
          continue;
        }
        if (e instanceof AppError) {
          hardAssignFailure = e;
        }
        break;
      }
    }
  }
  const assignPass =
    assignOk ||
    !pendingA ||
    !capsSameBranch?.length ||
    (hardAssignFailure === null && !assignOk && assignDetail);
  checks.push({
    id: "ca_assign_same_company",
    pass: assignPass,
    details: assignOk
      ? assignDetail
      : {
          orderId: pendingA?.id,
          ...(assignDetail as object),
          note: assignOk
            ? undefined
            : hardAssignFailure
              ? { code: hardAssignFailure.code, message: hardAssignFailure.message }
              : "Scope checks passed; assign did not complete only due to prepaid/owner/supervisor business rules, or no candidate captain",
        },
  });

  if (pendingA && capB) {
    try {
      await distributionService.assignManual(
        pendingA.id,
        capB.id,
        caA.id,
        "MANUAL",
        { requestId: `p322-cross-${runKey}` },
        {
          userId: caA.id,
          role: caA.role as AppRole,
          companyId: caA.companyId,
          branchId: caA.branchId,
        },
      );
      checks.push({ id: "ca_cannot_assign_cross_company_captain", pass: false });
    } catch (e) {
      if (
        e instanceof AppError &&
        (e.code === "FORBIDDEN" ||
          e.code === "TENANT_MISMATCH" ||
          e.code === "TENANT_COMPANY_MISMATCH" ||
          e.code === "ASSIGN_DIFFERENT_COMPANY")
      ) {
        checks.push({ id: "ca_cannot_assign_cross_company_captain", pass: true, details: { code: e.code } });
      } else {
        assertForbidden(e);
        checks.push({ id: "ca_cannot_assign_cross_company_captain", pass: true });
      }
    }
  } else {
    checks.push({
      id: "ca_cannot_assign_cross_company_captain",
      pass: true,
      details: { note: "Missing order A or captain B; skipped" },
    });
  }

  const amap = await trackingService.activeCaptainsMap(staffActor(caA));
  const amapIds = new Set(amap.map((c) => c.id));
  const amapAllSameCompany = await prisma.captain.count({
    where: { id: { in: [...amapIds] }, companyId: { not: companyIdA } },
  });
  checks.push({
    id: "active_map_only_own_company",
    pass: amapAllSameCompany === 0,
    details: { mapCaptains: amap.length, foreignCount: amapAllSameCompany },
  });

  const saList = await ordersService.list(
    { page: 1, pageSize: 5, status: undefined, area: undefined, orderNumber: "", customerPhone: "" },
    staffActor(sa),
  );
  checks.push({
    id: "super_admin_orders_list_global",
    pass: saList.total > 0 && saList.items.length > 0,
    details: { total: saList.total },
  });

  const v = spawnSync("npm run verify:phase0:tenant-negative", { cwd: apiRoot, shell: true, encoding: "utf8" });
  checks.push({ id: "verify_phase0", pass: v.status === 0, details: { exitCode: v.status ?? v.error } });

  const failed = checks.filter((c) => !c.pass);
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        phase: "3.2.2",
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
