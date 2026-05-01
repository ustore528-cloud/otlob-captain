/**
 * Operational QA-STRESS dispatch exerciser (DB/API-side only; no UI automation).
 *
 * Uses deterministic QA-only rows, avoids non-QA mutations.
 * Dispatch is performed via synthetic offer creation (same tables used by runtime),
 * then captain-service actions are used for accept/reject/status transitions.
 */
import "dotenv/config";
import { AssignmentResponseStatus, AssignmentType, CaptainAvailabilityStatus, OrderStatus, UserRole } from "@prisma/client";
import fs from "node:fs/promises";
import path from "node:path";
import { captainMobileService } from "../src/services/captain-mobile.service.js";
import { prisma } from "../src/lib/prisma.js";
import { distributionService } from "../src/services/distribution/index.js";
import { ordersService } from "../src/services/orders.service.js";
import {
  QA_STRESS_CAPTAIN_NAME_RE,
  QA_STRESS_COMPANY_ADMIN_RE,
  QA_STRESS_COMPANY_NAME_RE,
  QA_STRESS_ORDER_PREFIX,
} from "./qa-stress-constants.js";

type Summary = {
  activeCaptains: number;
  availableCaptains: number;
  captainsWithLocation: number;
  offersCreated: number;
  wrongCompanyOffers: number;
  duplicatePendingOffers: number;
  accepted: number;
  delivered: number;
  rejected: number;
  rejectAttempts: number;
  expired: number;
  reassigned: number;
  cancelled: number;
  errors: string[];
};

async function main() {
  const errors: string[] = [];
  const summary: Summary = {
    activeCaptains: 0,
    availableCaptains: 0,
    captainsWithLocation: 0,
    offersCreated: 0,
    wrongCompanyOffers: 0,
    duplicatePendingOffers: 0,
    accepted: 0,
    delivered: 0,
    rejected: 0,
    rejectAttempts: 0,
    expired: 0,
    reassigned: 0,
    cancelled: 0,
    errors,
  };

  const qaCompanies = await prisma.company.findMany({
    where: { name: { startsWith: "QA-STRESS-Company-" } },
    select: { id: true, name: true },
  });
  const strictCompanies = qaCompanies.filter((c) => QA_STRESS_COMPANY_NAME_RE.test(c.name));
  const companyIds = strictCompanies.map((c) => c.id);
  if (companyIds.length === 0) throw new Error("No QA-STRESS companies found.");

  const qaCaptains = await prisma.captain.findMany({
    where: {
      companyId: { in: companyIds },
      user: { role: UserRole.CAPTAIN },
    },
    select: {
      id: true,
      companyId: true,
      branchId: true,
      userId: true,
      user: { select: { fullName: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const strictQaCaptains = qaCaptains.filter((c) => QA_STRESS_CAPTAIN_NAME_RE.test(c.user.fullName));
  const captainIds = strictQaCaptains.map((c) => c.id);

  // 1) captain prep
  await prisma.user.updateMany({
    where: { id: { in: strictQaCaptains.map((c) => c.userId) } },
    data: { isActive: true },
  });
  await prisma.captain.updateMany({
    where: { id: { in: captainIds } },
    data: { isActive: true, availabilityStatus: CaptainAvailabilityStatus.AVAILABLE },
  });

  for (const c of strictQaCaptains) {
    const s = await prisma.store.findFirst({
      where: { companyId: c.companyId, branchId: c.branchId },
      select: { latitude: true, longitude: true },
      orderBy: { createdAt: "asc" },
    });
    await prisma.captainLocation.create({
      data: {
        captainId: c.id,
        latitude: (s?.latitude ?? 24.7136) + 0.0005,
        longitude: (s?.longitude ?? 46.6753) + 0.0005,
      },
    });
  }

  summary.activeCaptains = await prisma.captain.count({ where: { id: { in: captainIds }, isActive: true } });
  summary.availableCaptains = await prisma.captain.count({
    where: { id: { in: captainIds }, availabilityStatus: CaptainAvailabilityStatus.AVAILABLE },
  });
  summary.captainsWithLocation = await prisma.captainLocation.groupBy({
    by: ["captainId"],
    where: { captainId: { in: captainIds } },
    _count: { captainId: true },
  }).then((rows) => rows.length);

  // 2) synthetic dispatch: create ASSIGNED + pending log for QA PENDING only
  const qaOrders = await prisma.order.findMany({
    where: { orderNumber: { startsWith: QA_STRESS_ORDER_PREFIX } },
    select: { id: true, companyId: true, branchId: true, status: true, assignedCaptainId: true },
    orderBy: { createdAt: "asc" },
  });
  const captainsByCompanyBranch = new Map<string, typeof strictQaCaptains>();
  for (const c of strictQaCaptains) {
    const k = `${c.companyId}:${c.branchId}`;
    const arr = captainsByCompanyBranch.get(k) ?? [];
    arr.push(c);
    captainsByCompanyBranch.set(k, arr);
  }
  const rr = new Map<string, number>();

  for (const o of qaOrders) {
    if (![OrderStatus.PENDING, OrderStatus.CONFIRMED].includes(o.status)) continue;
    const ck = `${o.companyId}:${o.branchId}`;
    const pool = captainsByCompanyBranch.get(ck) ?? [];
    if (pool.length === 0) {
      errors.push(`No QA captain in company ${o.companyId} branch ${o.branchId} for order ${o.id}`);
      continue;
    }
    const idx = rr.get(ck) ?? 0;
    const chosen = pool[idx % pool.length];
    rr.set(ck, idx + 1);

    const existingPending = await prisma.orderAssignmentLog.findFirst({
      where: { orderId: o.id, responseStatus: AssignmentResponseStatus.PENDING },
      select: { id: true },
    });
    if (existingPending) continue;

    await prisma.order.update({
      where: { id: o.id },
      data: { assignedCaptainId: chosen.id, status: OrderStatus.ASSIGNED },
    });
    await prisma.orderAssignmentLog.create({
      data: {
        orderId: o.id,
        captainId: chosen.id,
        assignmentType: AssignmentType.AUTO,
        responseStatus: AssignmentResponseStatus.PENDING,
        // Long-lived offers: script runs reject/expire/reassign before deliver; 30s caused mass EXPIRED before accept.
        expiredAt: new Date(Date.now() + 45 * 60 * 1000),
        notes: "QA-STRESS synthetic offer",
      },
    });
    summary.offersCreated += 1;
  }

  // offer correctness metrics
  const pendingLogs = await prisma.orderAssignmentLog.findMany({
    where: {
      responseStatus: AssignmentResponseStatus.PENDING,
      order: { orderNumber: { startsWith: QA_STRESS_ORDER_PREFIX } },
    },
    select: { orderId: true, order: { select: { companyId: true } }, captain: { select: { companyId: true } } },
  });
  summary.wrongCompanyOffers = pendingLogs.filter((x) => x.order.companyId !== x.captain.companyId).length;
  const byOrder = new Map<string, number>();
  for (const l of pendingLogs) byOrder.set(l.orderId, (byOrder.get(l.orderId) ?? 0) + 1);
  summary.duplicatePendingOffers = [...byOrder.values()].filter((n) => n > 1).length;

  // 3) outcomes
  // reject 5 — only rows with a PENDING log for the order's current assignee (avoids INVALID_STATE noise)
  const pendingRejectLogs = await prisma.orderAssignmentLog.findMany({
    where: {
      responseStatus: AssignmentResponseStatus.PENDING,
      order: { orderNumber: { startsWith: QA_STRESS_ORDER_PREFIX }, status: OrderStatus.ASSIGNED },
    },
    select: {
      orderId: true,
      captain: { select: { id: true, userId: true } },
      order: { select: { assignedCaptainId: true } },
    },
    orderBy: { assignedAt: "desc" },
    take: 80,
  });
  const rejectSeen = new Set<string>();
  for (const row of pendingRejectLogs) {
    if (summary.rejected >= 5) break;
    if (!row.captain.userId) continue;
    if (row.order.assignedCaptainId !== row.captain.id) continue;
    if (rejectSeen.has(row.orderId)) continue;
    rejectSeen.add(row.orderId);
    summary.rejectAttempts += 1;
    try {
      await captainMobileService.rejectOrder(row.orderId, row.captain.userId);
      summary.rejected += 1;
    } catch (e) {
      errors.push(`reject ${row.orderId}: ${(e as Error).message}`);
    }
  }

  // expire 5 remaining pending offers
  const expireLogs = await prisma.orderAssignmentLog.findMany({
    where: {
      responseStatus: AssignmentResponseStatus.PENDING,
      order: { orderNumber: { startsWith: QA_STRESS_ORDER_PREFIX } },
    },
    select: { id: true },
    take: 5,
  });
  if (expireLogs.length > 0) {
    await prisma.orderAssignmentLog.updateMany({
      where: { id: { in: expireLogs.map((r) => r.id) } },
      data: { expiredAt: new Date(Date.now() - 60_000) },
    });
    await distributionService.tickExpired();
  }

  // reassign 5 by cancelling prior pending + creating new pending for another captain
  const reassignOrders = await prisma.order.findMany({
    where: {
      orderNumber: { startsWith: QA_STRESS_ORDER_PREFIX },
      status: OrderStatus.ASSIGNED,
      assignedCaptainId: { not: null },
    },
    select: { id: true, companyId: true, branchId: true, assignedCaptainId: true },
    take: 20,
  });
  for (const o of reassignOrders) {
    if (!o.assignedCaptainId) continue;
    const pool = (captainsByCompanyBranch.get(`${o.companyId}:${o.branchId}`) ?? []).filter(
      (c) => c.id !== o.assignedCaptainId,
    );
    if (pool.length === 0) continue;
    const newCap = pool[0];
    await prisma.orderAssignmentLog.updateMany({
      where: { orderId: o.id, responseStatus: AssignmentResponseStatus.PENDING },
      data: { responseStatus: AssignmentResponseStatus.CANCELLED, notes: "QA-STRESS reassigned" },
    });
    await prisma.order.update({ where: { id: o.id }, data: { assignedCaptainId: newCap.id } });
    await prisma.orderAssignmentLog.create({
      data: {
        orderId: o.id,
        captainId: newCap.id,
        assignmentType: AssignmentType.REASSIGN,
        responseStatus: AssignmentResponseStatus.PENDING,
        // Long-lived offers: script runs reject/expire/reassign before deliver; 30s caused mass EXPIRED before accept.
        expiredAt: new Date(Date.now() + 45 * 60 * 1000),
        notes: "QA-STRESS reassigned synthetic",
      },
    });
    summary.reassigned += 1;
    if (summary.reassigned >= 5) break;
  }

  // accept + deliver 30 — re-read DB each iteration (pendings/expiry/eviction change while processing).
  const qaDeliverPrepTtlMs = 50 * 60 * 1000;
  const deliverSkipOrderIds = new Set<string>();
  for (let attempt = 0; summary.delivered < 30 && attempt < 320; attempt += 1) {
    const batch = await prisma.orderAssignmentLog.findMany({
      where: {
        responseStatus: AssignmentResponseStatus.PENDING,
        order: {
          orderNumber: { startsWith: QA_STRESS_ORDER_PREFIX },
          status: OrderStatus.ASSIGNED,
        },
      },
      select: {
        id: true,
        orderId: true,
        captainId: true,
        assignedAt: true,
        captain: { select: { userId: true, branchId: true } },
        order: { select: { branchId: true } },
      },
      orderBy: [{ assignedAt: "desc" }, { id: "desc" }],
      take: 500,
    });
    const newestByOrder = new Map<string, (typeof batch)[0]>();
    const cancelDupIds: string[] = [];
    for (const row of batch) {
      if (!newestByOrder.has(row.orderId)) newestByOrder.set(row.orderId, row);
      else cancelDupIds.push(row.id);
    }
    if (cancelDupIds.length > 0) {
      await prisma.orderAssignmentLog.updateMany({
        where: { id: { in: cancelDupIds } },
        data: { responseStatus: AssignmentResponseStatus.CANCELLED, notes: "QA-STRESS dedupe stale pending" },
      });
    }
    const cand = [...newestByOrder.values()].find(
      (r) =>
        r.captain.userId &&
        r.captain.branchId === r.order.branchId &&
        !deliverSkipOrderIds.has(r.orderId),
    );
    if (!cand?.captain.userId) break;

    try {
      const deliverOfferTtl = new Date(Date.now() + qaDeliverPrepTtlMs);
      await prisma.order.update({
        where: { id: cand.orderId },
        data: { assignedCaptainId: cand.captainId },
      });
      await prisma.orderAssignmentLog.update({
        where: { id: cand.id },
        data: { expiredAt: deliverOfferTtl },
      });
      await captainMobileService.acceptOrder(cand.orderId, cand.captain.userId);
      summary.accepted += 1;
      await captainMobileService.updateOrderStatus(cand.orderId, OrderStatus.PICKED_UP, cand.captain.userId);
      await captainMobileService.updateOrderStatus(cand.orderId, OrderStatus.IN_TRANSIT, cand.captain.userId);
      await captainMobileService.updateOrderStatus(cand.orderId, OrderStatus.DELIVERED, cand.captain.userId);
      summary.delivered += 1;
    } catch (e) {
      deliverSkipOrderIds.add(cand.orderId);
      errors.push(`deliver-flow ${cand.orderId}: ${(e as Error).message}`);
    }
  }

  // cancel 5
  const superAdmin = await prisma.user.findFirst({
    where: { role: UserRole.SUPER_ADMIN, isActive: true },
    select: { id: true },
  });
  if (superAdmin) {
    const cancelOrders = await prisma.order.findMany({
      where: {
        orderNumber: { startsWith: QA_STRESS_ORDER_PREFIX },
        status: { in: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.ASSIGNED, OrderStatus.ACCEPTED] },
      },
      select: { id: true },
      take: 5,
    });
    for (const o of cancelOrders) {
      try {
        await ordersService.updateStatus(o.id, OrderStatus.CANCELLED, {
          userId: superAdmin.id,
          role: "SUPER_ADMIN",
          storeId: null,
          companyId: null,
          branchId: null,
        });
        summary.cancelled += 1;
      } catch (e) {
        errors.push(`cancel ${o.id}: ${(e as Error).message}`);
      }
    }
  }

  summary.expired = await prisma.orderAssignmentLog.count({
    where: {
      responseStatus: AssignmentResponseStatus.EXPIRED,
      order: { orderNumber: { startsWith: QA_STRESS_ORDER_PREFIX } },
    },
  });

  const out = {
    generatedAt: new Date().toISOString(),
    summary,
    post: {
      pendingOrders: await prisma.order.count({
        where: { orderNumber: { startsWith: QA_STRESS_ORDER_PREFIX }, status: OrderStatus.PENDING },
      }),
      assignedOrders: await prisma.order.count({
        where: { orderNumber: { startsWith: QA_STRESS_ORDER_PREFIX }, status: OrderStatus.ASSIGNED },
      }),
      deliveredOrders: await prisma.order.count({
        where: { orderNumber: { startsWith: QA_STRESS_ORDER_PREFIX }, status: OrderStatus.DELIVERED },
      }),
      cancelledOrders: await prisma.order.count({
        where: { orderNumber: { startsWith: QA_STRESS_ORDER_PREFIX }, status: OrderStatus.CANCELLED },
      }),
      rejectedLogs: await prisma.orderAssignmentLog.count({
        where: {
          responseStatus: AssignmentResponseStatus.REJECTED,
          order: { orderNumber: { startsWith: QA_STRESS_ORDER_PREFIX } },
        },
      }),
      expiredLogs: await prisma.orderAssignmentLog.count({
        where: {
          responseStatus: AssignmentResponseStatus.EXPIRED,
          order: { orderNumber: { startsWith: QA_STRESS_ORDER_PREFIX } },
        },
      }),
    },
  };

  const outPath = path.resolve(process.cwd(), "tmp", "qa-stress-operational-summary.json");
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(out, null, 2), "utf8");
  // eslint-disable-next-line no-console
  console.error(JSON.stringify({ outPath, ...out }, null, 2));
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

