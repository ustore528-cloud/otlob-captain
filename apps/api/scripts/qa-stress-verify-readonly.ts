/**
 * Read-only QA-STRESS verification (no mutations).
 *
 * Usage:
 *   cd apps/api && npx tsx scripts/qa-stress-verify-readonly.ts [--strict]
 *      [--expect-companies=N] [--expect-branches=N] [--expect-captains=N] [--expect-orders=N]
 *
 * Writes apps/api/tmp/qa-stress-verify-summary.json (summary JSON).
 */
import { AssignmentResponseStatus, OrderStatus } from "@prisma/client";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "..", ".env"), override: true });

import { prisma } from "../src/lib/prisma.js";
import {
  QA_STRESS_COMPANY_NAME_RE,
  QA_STRESS_CAPTAIN_NAME_RE,
  QA_STRESS_BRANCH_NAME_RE,
  QA_STRESS_ORDER_NUMBER_RE,
  QA_STRESS_ORDER_PREFIX,
} from "./qa-stress-constants.js";

const argv = process.argv;
const strict = argv.includes("--strict");

function parseExpect(flag: string): number | null {
  const raw = argv.find((a) => a.startsWith(`${flag}=`));
  if (raw == null) return null;
  const n = Number(raw.split("=").at(-1));
  return Number.isFinite(n) ? n : null;
}

const expectCompanies = parseExpect("--expect-companies");
const expectBranches = parseExpect("--expect-branches");
const expectCaptains = parseExpect("--expect-captains");
const expectOrders = parseExpect("--expect-orders");

function groupCount<T extends string | number>(
  rows: { key: T }[],
): { key: T; count: number }[] {
  const m = new Map<T, number>();
  for (const r of rows) {
    m.set(r.key, (m.get(r.key) ?? 0) + 1);
  }
  return [...m.entries()].map(([key, count]) => ({ key, count }));
}

async function main() {
  const qaCompanies = await prisma.company.findMany({
    where: { name: { startsWith: "QA-STRESS-Company-" } },
    select: { id: true, name: true },
  });
  const wellFormedCompanies = qaCompanies.filter((c) => QA_STRESS_COMPANY_NAME_RE.test(c.name));

  /** Strict seeded tenant IDs only (NNN pattern); excludes stray loose name-prefix rows. */
  const qaTenantCompanyIds = new Set(wellFormedCompanies.map((c) => c.id));
  const tenantCompanyIdList = [...qaTenantCompanyIds];

  const orders = await prisma.order.findMany({
    where: { orderNumber: { startsWith: QA_STRESS_ORDER_PREFIX } },
    select: {
      id: true,
      orderNumber: true,
      companyId: true,
      branchId: true,
      storeId: true,
      status: true,
    },
  });

  const ordersMalformedNumber = orders.filter((o) => !QA_STRESS_ORDER_NUMBER_RE.test(o.orderNumber));

  const ordersMissingCompany = orders.filter((o) => !o.companyId.trim());
  const ordersMissingBranch = orders.filter((o) => !o.branchId.trim());
  const ordersMissingStore = orders.filter((o) => !o.storeId.trim());

  const ordersWrongCompanyTenant = orders.filter((o) => !qaTenantCompanyIds.has(o.companyId));

  const byCompanyOrders = groupCount(orders.map((o) => ({ key: o.companyId })));

  const qaBranches = await prisma.branch.findMany({
    where: { name: { startsWith: "QA-STRESS-" } },
    select: { id: true, name: true, companyId: true },
  });
  const wellFormedBranches = qaBranches.filter((b) => QA_STRESS_BRANCH_NAME_RE.test(b.name));
  const branchesOutsideStrictTenant = qaBranches.filter((b) => !qaTenantCompanyIds.has(b.companyId));

  const captains =
    tenantCompanyIdList.length === 0 ?
      []
    : await prisma.captain.findMany({
        where: { companyId: { in: tenantCompanyIdList } },
    select: { id: true, companyId: true, branchId: true, user: { select: { fullName: true } } },
  });
  const wellNamedCaptains = captains.filter((c) => QA_STRESS_CAPTAIN_NAME_RE.test(c.user.fullName));
  const captainsMissingCompany = captains.filter((c) => !c.companyId.trim());
  const byCompanyCaptains = groupCount(captains.map((c) => ({ key: c.companyId })));

  const orderIds = orders.map((o) => o.id);

  const logs =
    orderIds.length === 0
      ? []
      : await prisma.orderAssignmentLog.findMany({
          where: { orderId: { in: orderIds } },
          include: {
            captain: { select: { id: true, companyId: true } },
            order: { select: { companyId: true, orderNumber: true } },
          },
        });

  const crossCompanyAssignments = logs.filter((l) => l.captain.companyId !== l.order.companyId);

  const pendingByOrder = new Map<string, number>();
  for (const l of logs) {
    if (l.responseStatus === AssignmentResponseStatus.PENDING) {
      pendingByOrder.set(l.orderId, (pendingByOrder.get(l.orderId) ?? 0) + 1);
    }
  }
  const duplicatePendingOrders = [...pendingByOrder.entries()].filter(([, c]) => c > 1);

  const stuckishStatuses: OrderStatus[] = [
    OrderStatus.PENDING,
    OrderStatus.CONFIRMED,
    OrderStatus.ASSIGNED,
    OrderStatus.ACCEPTED,
  ];
  const potentiallyStuck = orders.filter((o) => stuckishStatuses.includes(o.status));

  const delivered = orders.filter((o) => o.status === OrderStatus.DELIVERED);
  const cancelled = orders.filter((o) => o.status === OrderStatus.CANCELLED);

  const rejectedLogs = logs.filter((l) => l.responseStatus === AssignmentResponseStatus.REJECTED);
  const expiredLogs = logs.filter((l) => l.responseStatus === AssignmentResponseStatus.EXPIRED);

  /** Branches matching both naming regex and strict tenant companies (target for `--expect-branches`). */
  const branchesStrictTenantWellFormed = wellFormedBranches.filter((b) => qaTenantCompanyIds.has(b.companyId));

  const summary = {
    expected: {
      companies: expectCompanies,
      branches: expectBranches,
      captains: expectCaptains,
      orders: expectOrders,
    },
    actual: {
      qaCompaniesLoaded: qaCompanies.length,
      qaCompaniesWellFormed: wellFormedCompanies.length,
      qaBranchesWellFormed: branchesStrictTenantWellFormed.length,
      captainsLoaded: captains.length,
      captainsWellNamed: wellNamedCaptains.length,
      ordersLoaded: orders.length,
    },
    ordersPerCompany: byCompanyOrders,
    captainsPerCompany: byCompanyCaptains,
    integrity: {
      ordersMissingCompanyId: ordersMissingCompany.length,
      ordersMissingBranchId: ordersMissingBranch.length,
      ordersMissingStoreId: ordersMissingStore.length,
      ordersCompanyNotInQaStressTenant: ordersWrongCompanyTenant.length,
      captainsMissingCompanyId: captainsMissingCompany.length,
      branchesOutsideStrictTenant: branchesOutsideStrictTenant.length,
      malformedOrderNumbers: ordersMalformedNumber.length,
    },
    dispatch: {
      crossCompanyAssignmentRows: crossCompanyAssignments.length,
      duplicatePendingOrders: duplicatePendingOrders.length,
      assignmentLogsTotal: logs.length,
      rejectedAssignmentLogs: rejectedLogs.length,
      expiredAssignmentLogs: expiredLogs.length,
    },
    statuses: orders.reduce(
      (acc, o) => {
        acc[o.status] = (acc[o.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ),
    counts: {
      delivered: delivered.length,
      cancelled: cancelled.length,
      potentiallyStuckOperational: potentiallyStuck.length,
    },
  };

  let failed = false;

  const checkExpect = (label: string, expected: number | null, actual: number) => {
    if (expected == null) return;
    if (actual !== expected) {
      console.error(`[qa-stress-verify-readonly] ${label}: expected ${expected}, got ${actual}`);
      if (strict) failed = true;
    }
  };

  checkExpect("companies (well-formed QA-STRESS names)", expectCompanies, wellFormedCompanies.length);
  checkExpect("branches (QA-STRESS regex + strict tenant)", expectBranches, branchesStrictTenantWellFormed.length);
  checkExpect(
    "captains (attached to qa company set — use seeded captains)",
    expectCaptains,
    captains.length,
  );
  checkExpect("orders (orderNumber QA-STRESS-*)", expectOrders, orders.length);

  if (strict && summary.integrity.branchesOutsideStrictTenant > 0) failed = true;

  if (
    summary.integrity.ordersMissingCompanyId > 0 ||
    summary.integrity.ordersMissingBranchId > 0 ||
    summary.integrity.ordersMissingStoreId > 0 ||
    summary.integrity.captainsMissingCompanyId > 0
  ) {
    console.error("[qa-stress-verify-readonly] integrity violations on required FK fields");
    if (strict) failed = true;
  }

  if (summary.integrity.ordersCompanyNotInQaStressTenant > 0) {
    console.error(
      "[qa-stress-verify-readonly] QA-STRESS-* orders referencing companyId outside QA-STRESS-Company-* set:",
      summary.integrity.ordersCompanyNotInQaStressTenant,
    );
    if (strict) failed = true;
  }

  if (strict && crossCompanyAssignments.length > 0) failed = true;
  if (strict && duplicatePendingOrders.length > 0) failed = true;

  const outPath = path.resolve(process.cwd(), "tmp", "qa-stress-verify-summary.json");
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(
    outPath,
    JSON.stringify({ summary, failed, strict }, null, 2),
    "utf8",
  );

  console.error(JSON.stringify({ summary, failed, summaryJsonPath: outPath }, null, 2));

  if (failed) process.exit(1);
}

await main();
