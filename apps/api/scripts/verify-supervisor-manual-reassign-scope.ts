/**
 * Live verification for supervisor-linked manual assign / reassign scope.
 * Prereq: API on VERIFY_API_BASE (default http://127.0.0.1:4000), DB seeded (dispatcher +966500000002, seed store, two captains).
 *
 * Run from `apps/api`: `npx tsx scripts/verify-supervisor-manual-reassign-scope.ts`
 */
import "dotenv/config";
import {
  DistributionMode,
  OrderStatus,
  StoreSubscriptionType,
} from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";

const BASE = (process.env.VERIFY_API_BASE ?? "http://127.0.0.1:4000").replace(/\/$/, "");
const SEED_STORE_ID = "seed-store-main";

async function login(phone: string, password: string = "Admin12345!"): Promise<string> {
  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, password }),
  });
  const j = (await res.json()) as { success?: boolean; data?: { accessToken?: string } };
  if (!res.ok || !j.success || !j.data?.accessToken) {
    throw new Error(`Login failed: ${res.status} ${JSON.stringify(j)}`);
  }
  return j.data.accessToken;
}

async function postManual(token: string, orderId: string, captainId: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${BASE}/api/v1/orders/${orderId}/distribution/manual`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ captainId }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function postReassign(token: string, orderId: string, captainId: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${BASE}/api/v1/orders/${orderId}/reassign`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ captainId }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

function assertFail(msg: string): never {
  // eslint-disable-next-line no-console
  console.error("[verify-supervisor-scope] FAIL:", msg);
  process.exit(1);
}

async function main() {
  const token = await login("+966500000002").catch((e) => {
    assertFail(`API unreachable or login failed (${BASE}). ${String(e)}`);
  });

  const dispatcher = await prisma.user.findUnique({ where: { phone: "+966500000002" } });
  if (!dispatcher) assertFail("dispatcher user not found");

  const store = await prisma.store.findUnique({ where: { id: SEED_STORE_ID } });
  if (!store) assertFail("seed store not found");

  const cap511User = await prisma.user.findUnique({ where: { phone: "+966511111111" } });
  const cap999User = await prisma.user.findUnique({ where: { phone: "+966599999991" } });
  if (!cap511User || !cap999User) assertFail("seed captain users not found");

  const capMatch = await prisma.captain.findUniqueOrThrow({ where: { userId: cap511User.id } });
  const capMismatch = await prisma.captain.findUniqueOrThrow({ where: { userId: cap999User.id } });
  const origCapMismatchPrepaid = capMismatch.prepaidBalance;

  const origStore = {
    subscriptionType: store.subscriptionType,
    supervisorUserId: store.supervisorUserId,
  };
  const origCapMatchSupervisor = capMatch.supervisorUserId;
  const origCapMismatchSupervisor = capMismatch.supervisorUserId;

  const suffix = Date.now();
  let slOrderId: string | null = null;
  let pubOrderId: string | null = null;

  try {
    await prisma.store.update({
      where: { id: SEED_STORE_ID },
      data: {
        subscriptionType: StoreSubscriptionType.SUPERVISOR_LINKED,
        supervisorUser: { connect: { id: dispatcher.id } },
      },
    });
    await prisma.captain.update({
      where: { id: capMatch.id },
      data: { supervisorUser: { connect: { id: dispatcher.id } } },
    });
    await prisma.captain.update({
      where: { id: capMismatch.id },
      data: { supervisorUser: { disconnect: true } },
    });

    const slOrder = await prisma.order.create({
      data: {
        orderNumber: `VERIFY-SL-${suffix}`,
        customerName: "Verify SL",
        customerPhone: "+966500000099",
        companyId: store.companyId,
        branchId: store.branchId,
        storeId: SEED_STORE_ID,
        pickupAddress: "p",
        dropoffAddress: "d",
        area: "الرياض",
        amount: 10,
        cashCollection: 0,
        status: OrderStatus.PENDING,
        distributionMode: DistributionMode.AUTO,
      },
    });
    slOrderId = slOrder.id;

    const snapBeforeMismatch = await prisma.order.findUniqueOrThrow({
      where: { id: slOrderId },
      select: { assignedCaptainId: true, status: true, updatedAt: true },
    });
    const logsBeforeMismatch = await prisma.orderAssignmentLog.count({ where: { orderId: slOrderId } });

    const rMismatch = await postManual(token, slOrderId, capMismatch.id);
    if (rMismatch.status !== 403) assertFail(`Expected 403 mismatch manual, got ${rMismatch.status} ${JSON.stringify(rMismatch.body)}`);
    const err = rMismatch.body as { success?: boolean; error?: { code?: string } };
    if (err.success !== false || err.error?.code !== "CAPTAIN_SUPERVISOR_SCOPE") {
      assertFail(`Expected CAPTAIN_SUPERVISOR_SCOPE, got ${JSON.stringify(rMismatch.body)}`);
    }
    const snapAfterMismatch = await prisma.order.findUniqueOrThrow({
      where: { id: slOrderId },
      select: { assignedCaptainId: true, status: true, updatedAt: true },
    });
    const logsAfterMismatch = await prisma.orderAssignmentLog.count({ where: { orderId: slOrderId } });
    if (snapAfterMismatch.assignedCaptainId !== snapBeforeMismatch.assignedCaptainId) {
      assertFail("Order assignedCaptainId changed after rejected manual assign");
    }
    if (snapAfterMismatch.status !== snapBeforeMismatch.status) {
      assertFail("Order status changed after rejected manual assign");
    }
    if (logsAfterMismatch !== logsBeforeMismatch) {
      assertFail("Assignment logs changed after rejected manual assign");
    }

    const rMatch = await postManual(token, slOrderId, capMatch.id);
    if (rMatch.status !== 200) assertFail(`Expected 200 match manual, got ${rMatch.status} ${JSON.stringify(rMatch.body)}`);
    const ordAfterMatch = await prisma.order.findUniqueOrThrow({
      where: { id: slOrderId },
      select: { assignedCaptainId: true, status: true },
    });
    if (ordAfterMatch.assignedCaptainId !== capMatch.id || ordAfterMatch.status !== OrderStatus.ASSIGNED) {
      assertFail(`Expected ASSIGNED to capMatch, got ${JSON.stringify(ordAfterMatch)}`);
    }

    const rReassignBad = await postReassign(token, slOrderId, capMismatch.id);
    if (rReassignBad.status !== 403) assertFail(`Expected 403 mismatch reassign, got ${rReassignBad.status}`);
    const err2 = rReassignBad.body as { error?: { code?: string } };
    if (err2.error?.code !== "CAPTAIN_SUPERVISOR_SCOPE") {
      assertFail(`Expected CAPTAIN_SUPERVISOR_SCOPE on reassign, got ${JSON.stringify(rReassignBad.body)}`);
    }
    const ordAfterReassignFail = await prisma.order.findUniqueOrThrow({
      where: { id: slOrderId },
      select: { assignedCaptainId: true },
    });
    if (ordAfterReassignFail.assignedCaptainId !== capMatch.id) {
      assertFail("assignedCaptainId changed after rejected reassign");
    }

    // COMPANY_ADMIN / SUPER_ADMIN / legacy ADMIN bypass supervisor link — ensure prepaid can receive, then 200
    await prisma.captain.update({
      where: { id: capMismatch.id },
      data: { prepaidBalance: 50_000 },
    });
    const companyToken = await login("+966500000001");
    const rReassignBypass = await postReassign(companyToken, slOrderId, capMismatch.id);
    if (rReassignBypass.status !== 200) {
      assertFail(
        `Expected 200 company-admin bypass reassign to mismatch, got ${rReassignBypass.status} ${JSON.stringify(rReassignBypass.body)}`,
      );
    }
    const ordAfterAdminBypass = await prisma.order.findUniqueOrThrow({
      where: { id: slOrderId },
      select: { assignedCaptainId: true, status: true },
    });
    if (ordAfterAdminBypass.assignedCaptainId !== capMismatch.id) {
      assertFail(`After admin bypass reassign expected capMismatch, got ${JSON.stringify(ordAfterAdminBypass)}`);
    }
    if (ordAfterAdminBypass.status !== OrderStatus.ASSIGNED) {
      assertFail("Expected order still ASSIGNED after reassign");
    }

    await prisma.store.update({
      where: { id: SEED_STORE_ID },
      data: {
        subscriptionType: StoreSubscriptionType.PUBLIC,
        supervisorUser: { disconnect: true },
      },
    });

    const pubOrder = await prisma.order.create({
      data: {
        orderNumber: `VERIFY-PUB-${suffix}`,
        customerName: "Verify Pub",
        customerPhone: "+966500000098",
        companyId: store.companyId,
        branchId: store.branchId,
        storeId: SEED_STORE_ID,
        pickupAddress: "p",
        dropoffAddress: "d",
        area: "الرياض",
        amount: 11,
        cashCollection: 0,
        status: OrderStatus.PENDING,
        distributionMode: DistributionMode.AUTO,
      },
    });
    pubOrderId = pubOrder.id;

    // PUBLIC skips supervisor scope; use capMatch (has prepaid) — capMismatch is depleted and would 409 unrelated to PUBLIC.
    const rPub = await postManual(token, pubOrderId, capMatch.id);
    if (rPub.status !== 200) assertFail(`Expected 200 PUBLIC manual assign, got ${rPub.status} ${JSON.stringify(rPub.body)}`);

    // eslint-disable-next-line no-console
    console.info("[verify-supervisor-scope] PASS: all checks");
  } finally {
    if (slOrderId) await prisma.order.deleteMany({ where: { id: slOrderId } }).catch(() => {});
    if (pubOrderId) await prisma.order.deleteMany({ where: { id: pubOrderId } }).catch(() => {});

    await prisma.store
      .update({
        where: { id: SEED_STORE_ID },
        data: {
          subscriptionType: origStore.subscriptionType,
          ...(origStore.supervisorUserId
            ? { supervisorUser: { connect: { id: origStore.supervisorUserId } } }
            : { supervisorUser: { disconnect: true } }),
        },
      })
      .catch(() => {});

    await prisma.captain
      .update({
        where: { id: capMatch.id },
        data: {
          ...(origCapMatchSupervisor
            ? { supervisorUser: { connect: { id: origCapMatchSupervisor } } }
            : { supervisorUser: { disconnect: true } }),
        },
      })
      .catch(() => {});

    await prisma.captain
      .update({
        where: { id: capMismatch.id },
        data: {
          prepaidBalance: origCapMismatchPrepaid,
          ...(origCapMismatchSupervisor
            ? { supervisorUser: { connect: { id: origCapMismatchSupervisor } } }
            : { supervisorUser: { disconnect: true } }),
        },
      })
      .catch(() => {});
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
