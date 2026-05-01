/**
 * Phase 3.2.3 — COMPANY_ADMIN: relax order-owner / captain fleet (OWNER_MISMATCH) in distribution; keep tenant + prepaid.
 * Run: `npm run phase323:verify-company-admin-distribution-actions` from repo root with `-w @captain/api`
 */
import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { OrderStatus, UserRole } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";
import { distributionService } from "../src/services/distribution/index.js";
import { ordersService } from "../src/services/orders.service.js";
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

type FleetPair = { order: { id: string; ownerUserId: string | null; branchId: string }; cap: { id: string } };

async function findOwnerFleetMismatchPair(companyId: string): Promise<FleetPair | null> {
  const orders = await prisma.order.findMany({
    where: {
      companyId,
      archivedAt: null,
      ownerUserId: { not: null },
      status: { in: [OrderStatus.PENDING, OrderStatus.CONFIRMED] },
    },
    select: { id: true, ownerUserId: true, branchId: true },
    take: 200,
  });
  for (const o of orders) {
    if (!o.ownerUserId) continue;
    const cap = await prisma.captain.findFirst({
      where: {
        companyId,
        branchId: o.branchId,
        isActive: true,
        createdByUserId: { not: o.ownerUserId },
      },
      select: { id: true },
    });
    if (cap) {
      return { order: { id: o.id, ownerUserId: o.ownerUserId, branchId: o.branchId }, cap: { id: cap.id } };
    }
  }
  return null;
}

async function listFleetMismatchCaptains(companyId: string, branchId: string, ownerUserId: string) {
  return prisma.captain.findMany({
    where: {
      companyId,
      branchId,
      isActive: true,
      createdByUserId: { not: ownerUserId },
    },
    select: { id: true },
    orderBy: { id: "asc" },
    take: 30,
  });
}

async function main() {
  const checks: Check[] = [];
  const runKey = `p323-${Date.now()}`;

  const sa = await prisma.user.findFirst({ where: { isActive: true, role: UserRole.SUPER_ADMIN } });
  if (!sa) throw new Error("No active SUPER_ADMIN");

  const caA = await prisma.user.findFirst({
    where: { isActive: true, role: UserRole.COMPANY_ADMIN, companyId: { not: null } },
  });
  if (!caA?.companyId) throw new Error("No COMPANY_ADMIN with companyId");
  const companyIdA = caA.companyId;

  const otherCo = await prisma.company.findFirst({ where: { isActive: true, id: { not: companyIdA } } });
  if (!otherCo) throw new Error("Need a second company for cross-tenant checks");

  const capB = await prisma.captain.findFirst({ where: { companyId: otherCo.id, isActive: true } });
  const orderB = await prisma.order.findFirst({
    where: { companyId: otherCo.id, archivedAt: null },
    select: { id: true },
  });

  if (orderB) {
    try {
      await ordersService.getById(orderB.id, staffActor(caA));
      checks.push({ id: "ca_cannot_access_other_company_order", pass: false });
    } catch (e) {
      try {
        assertForbidden(e);
        checks.push({ id: "ca_cannot_access_other_company_order", pass: true });
      } catch {
        checks.push({ id: "ca_cannot_access_other_company_order", pass: false, details: { err: String(e) } });
      }
    }
  } else {
    checks.push({ id: "ca_cannot_access_other_company_order", pass: true, details: { note: "No order in B" } });
  }

  const pair = await findOwnerFleetMismatchPair(companyIdA);
  if (!pair) {
    checks.push({
      id: "ca_assign_same_company_non_owner_captain_no_owner_mismatch",
      pass: true,
      details: { note: "Skipped: no order+captain owner-fleet mismatch pair in company A" },
    });
    checks.push({
      id: "ca_reassign_non_owner_captain_no_owner_mismatch",
      pass: true,
      details: { note: "Skipped: no pair" },
    });
    checks.push({
      id: "ca_resend_same_company_no_owner_mismatch",
      pass: true,
      details: { note: "Skipped: no pair" },
    });
  } else {
    const actorScopeA = {
      userId: caA.id,
      role: caA.role as AppRole,
      companyId: caA.companyId,
      branchId: caA.branchId,
    };
    const candidates = await listFleetMismatchCaptains(
      companyIdA,
      pair.order.branchId,
      pair.order.ownerUserId!,
    );
    let assign1Ok = false;
    let caSawOwnerMismatch = false;
    let lastErr1: string | null = null;
    let firstCap: string | null = null;
    for (const c of candidates) {
      try {
        await distributionService.assignManual(
          pair.order.id,
          c.id,
          caA.id,
          "MANUAL",
          { requestId: `p323-m1-${runKey}-${c.id}` },
          actorScopeA,
        );
        assign1Ok = true;
        firstCap = c.id;
        lastErr1 = null;
        break;
      } catch (e) {
        if (e instanceof AppError && e.code === "OWNER_MISMATCH") {
          caSawOwnerMismatch = true;
          lastErr1 = "OWNER_MISMATCH";
          break;
        }
        lastErr1 = e instanceof AppError ? e.code ?? e.message : String(e);
      }
    }
    checks.push({
      id: "ca_assign_same_company_non_owner_captain_no_owner_mismatch",
      pass: !caSawOwnerMismatch,
      details: {
        orderId: pair.order.id,
        tried: candidates.length,
        ok: assign1Ok,
        lastErr: lastErr1,
        usedCaptainId: firstCap,
      },
    });

    const cap2 = firstCap
      ? candidates.find((c) => c.id !== firstCap) ?? null
      : null;
    if (assign1Ok && cap2) {
      let reassignOk = false;
      let errR: string | null = null;
      try {
        await distributionService.reassign(
          pair.order.id,
          cap2.id,
          caA.id,
          { requestId: `p323-re-${runKey}` },
          actorScopeA,
        );
        reassignOk = true;
      } catch (e) {
        errR = e instanceof AppError ? e.code : String(e);
        if (e instanceof AppError && e.code === "OWNER_MISMATCH") errR = "OWNER_MISMATCH";
      }
      checks.push({
        id: "ca_reassign_non_owner_captain_no_owner_mismatch",
        pass: reassignOk || errR !== "OWNER_MISMATCH",
        details: { captain2: cap2.id, err: errR, ok: reassignOk },
      });

      let resendOk = false;
      let errS: string | null = null;
      try {
        await distributionService.resendToDistribution(
          pair.order.id,
          caA.id,
          { requestId: `p323-rs-${runKey}` },
          actorScopeA,
        );
        resendOk = true;
      } catch (e) {
        errS = e instanceof AppError ? e.code : String(e);
        if (e instanceof AppError && e.code === "OWNER_MISMATCH") errS = "OWNER_MISMATCH";
      }
      checks.push({
        id: "ca_resend_same_company_no_owner_mismatch",
        pass: resendOk || errS !== "OWNER_MISMATCH",
        details: { err: errS, ok: resendOk },
      });
    } else {
      checks.push({
        id: "ca_reassign_non_owner_captain_no_owner_mismatch",
        pass: true,
        details: { note: "Skipped: no successful assign or only one candidate captain" },
      });
      checks.push({
        id: "ca_resend_same_company_no_owner_mismatch",
        pass: true,
        details: { note: "Skipped: no successful assign" },
      });
    }
  }

  if (pair && capB) {
    try {
      await distributionService.assignManual(
        pair.order.id,
        capB.id,
        caA.id,
        "MANUAL",
        { requestId: `p323-xco-${runKey}` },
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
        checks.push({ id: "ca_cannot_assign_cross_company_captain", pass: false, details: { err: String(e) } });
      }
    }
  } else {
    checks.push({
      id: "ca_cannot_assign_cross_company_captain",
      pass: true,
      details: { note: "Missing owner-mismatch pair or captain B" },
    });
  }

  const disp = await prisma.user.findFirst({
    where: { isActive: true, role: UserRole.DISPATCHER, companyId: companyIdA },
  });
  if (pair && disp) {
    let gotOwnerMismatch = false;
    try {
      await distributionService.assignManual(
        pair.order.id,
        pair.cap.id,
        disp.id,
        "MANUAL",
        { requestId: `p323-disp-${runKey}` },
        { userId: disp.id, role: disp.role as AppRole, companyId: disp.companyId, branchId: disp.branchId },
      );
    } catch (e) {
      if (e instanceof AppError && e.code === "OWNER_MISMATCH") gotOwnerMismatch = true;
    }
    checks.push({
      id: "dispatcher_still_gets_owner_mismatch_on_fleet_mismatch",
      pass: gotOwnerMismatch,
      details: { orderId: pair.order.id, captainId: pair.cap.id },
    });
  } else {
    checks.push({
      id: "dispatcher_still_gets_owner_mismatch_on_fleet_mismatch",
      pass: true,
      details: { note: "Skipped: no DISPATCHER in company A or no pair" },
    });
  }

  const saList = await ordersService.list(
    { page: 1, pageSize: 5, status: undefined, area: undefined, orderNumber: "", customerPhone: "" },
    staffActor(sa),
  );
  checks.push({
    id: "super_admin_orders_list_unchanged",
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
        phase: "3.2.3",
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
