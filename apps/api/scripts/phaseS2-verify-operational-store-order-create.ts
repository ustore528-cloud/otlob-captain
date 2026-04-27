/**
 * Phase S2.0: verify company-scoped operational store resolution for order create (no client storeId).
 *
 * - Uses `ordersService.create` (same path as the HTTP API).
 * - Asserts tenant safety and reuse. Archives QA-tagged rows at the end.
 *
 * Prereq: `DATABASE_URL` in apps/api/.env.
 * - With a normal seed: finds a COMPANY_ADMIN whose company has an active branch.
 * - If your DB has no such user, run with `PHASE_S2_BOOTSTRAP=1` once to create a minimal
 *   company «Phase S2 QA — operational store» + branch + admin (idempotent).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";
import { ordersService } from "../src/services/orders.service.js";
import { AppError } from "../src/utils/errors.js";
import { isOperationalStoreName } from "../src/services/operational-store.service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "..", ".env"), override: true });

const prisma = new PrismaClient();
const QA_NOTES = "PHASE_S2_QA";
const RANDOM7 = () => Math.random().toString(36).slice(2, 9);
const RANDOM_PHONE = () => `050${String(Math.floor(1e6 + Math.random() * 9e6)).padStart(7, "0")}`;
const S2_COMPANY_NAME = "Phase S2 QA — operational store";
const S2_COMPANY_KEY = "phase_s2_qa_ops";

type Step = { id: string; ok: boolean; detail: Record<string, unknown> };

/**
 * When `PHASE_S2_BOOTSTRAP=1`, creates a minimal company + branch + COMPANY_ADMIN
 * (idempotent by company name) so the verify can run on empty or partial dev DBs.
 */
async function bootstrapS2IfRequested(): Promise<void> {
  if (process.env.PHASE_S2_BOOTSTRAP !== "1") return;
  let c = await prisma.company.findFirst({ where: { name: S2_COMPANY_NAME } });
  if (!c) {
    c = await prisma.company.create({ data: { name: S2_COMPANY_NAME, isActive: true } });
  }
  const b0 = await prisma.branch.findFirst({
    where: { companyId: c.id, isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (!b0) {
    await prisma.branch.create({
      data: { companyId: c.id, name: `${S2_COMPANY_KEY}-branch-1`, isActive: true },
    });
  }
  const hasCa = await prisma.user.findFirst({
    where: { companyId: c.id, role: UserRole.COMPANY_ADMIN, isActive: true },
  });
  if (!hasCa) {
    const pass = await bcrypt.hash(`S2QA_${RANDOM7()}_nologin`, 8);
    const phone = `+9725${String(8000000 + Math.floor(Math.random() * 999999)).padStart(7, "0")}`;
    await prisma.user.create({
      data: {
        fullName: "Phase S2 QA Company Admin",
        phone,
        email: `phase.s2.qa.ops.${RANDOM7()}@local.test`,
        passwordHash: pass,
        role: UserRole.COMPANY_ADMIN,
        isActive: true,
        companyId: c.id,
      },
    });
  }
}

async function main() {
  await bootstrapS2IfRequested();
  const steps: Step[] = [];
  const createdOrderIds: string[] = [];
  const tag = RANDOM7();

  let companyAdmin = await prisma.user.findFirst({
    where: {
      role: UserRole.COMPANY_ADMIN,
      isActive: true,
      companyId: { not: null },
      company: { branches: { some: { isActive: true } } },
    },
    select: { id: true, companyId: true, branchId: true, fullName: true },
    orderBy: { createdAt: "asc" },
  });
  if (!companyAdmin) {
    const withBranch = await prisma.company.findFirst({
      where: { isActive: true, branches: { some: { isActive: true } } },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    if (withBranch) {
      companyAdmin = await prisma.user.findFirst({
        where: { role: UserRole.COMPANY_ADMIN, isActive: true, companyId: withBranch.id },
        select: { id: true, companyId: true, branchId: true, fullName: true },
        orderBy: { createdAt: "asc" },
      });
    }
  }
  if (!companyAdmin?.companyId) {
    throw new Error(
      "No COMPANY_ADMIN in a company with an active branch — seed dev data or create a branch first.",
    );
  }

  const otherCompany = await prisma.company.findFirst({
    where: { id: { not: companyAdmin.companyId } },
    select: { id: true, name: true },
  });
  const foreignStore = otherCompany
    ? await prisma.store.findFirst({
        where: { isActive: true, companyId: otherCompany.id },
        select: { id: true, companyId: true, branchId: true, name: true },
        orderBy: { createdAt: "asc" },
      })
    : null;

  const company = await prisma.company.findUnique({
    where: { id: companyAdmin.companyId },
    select: { id: true, name: true },
  });

  // --- 1) Company admin: no storeId — success
  const o1 = await ordersService.create(
    {
      customerName: `S2QA ${tag} A`,
      customerPhone: RANDOM_PHONE(),
      pickupAddress: `S2 pickup ${tag}`,
      dropoffAddress: `S2 dropoff ${tag}`,
      area: "S2",
      amount: 12,
      cashCollection: 12,
      deliveryFee: 0,
      notes: `${QA_NOTES} ${tag} first`,
      distributionMode: "MANUAL",
    },
    {
      userId: companyAdmin.id,
      role: "COMPANY_ADMIN",
      storeId: null,
      companyId: companyAdmin.companyId,
      branchId: companyAdmin.branchId,
    },
  );
  createdOrderIds.push(o1.id);

  const store1 = await prisma.store.findUnique({
    where: { id: o1.storeId },
    select: { id: true, name: true, companyId: true, branchId: true },
  });

  const opName1 = store1 ? isOperationalStoreName(store1.name) : false;
  steps.push({
    id: "ca_create_without_storeid",
    ok: Boolean(
      o1.id &&
        o1.companyId === companyAdmin.companyId &&
        o1.storeId &&
        store1 &&
        store1.companyId === companyAdmin.companyId &&
        opName1,
    ),
    detail: {
      orderId: o1.id,
      orderCompanyId: o1.companyId,
      storeId: o1.storeId,
      storeName: store1?.name,
      operationalName: opName1,
    },
  });

  // --- 2) Reuse: second order, same company admin, same storeId expected
  const o2 = await ordersService.create(
    {
      customerName: `S2QA ${tag} B`,
      customerPhone: RANDOM_PHONE(),
      pickupAddress: `S2 pickup ${tag}`,
      dropoffAddress: `S2 dropoff ${tag}`,
      area: "S2",
      amount: 11,
      cashCollection: 11,
      deliveryFee: 0,
      notes: `${QA_NOTES} ${tag} second`,
      distributionMode: "MANUAL",
    },
    {
      userId: companyAdmin.id,
      role: "COMPANY_ADMIN",
      storeId: null,
      companyId: companyAdmin.companyId,
      branchId: companyAdmin.branchId,
    },
  );
  createdOrderIds.push(o2.id);

  steps.push({
    id: "ca_reuse_operational_store",
    ok: o2.storeId === o1.storeId,
    detail: { firstStoreId: o1.storeId, secondStoreId: o2.storeId },
  });

  // --- 3) Injected wrong companyId is ignored; tenant is store-derived
  const o3 = await ordersService.create(
    {
      companyId: otherCompany?.id,
      customerName: `S2QA ${tag} C`,
      customerPhone: RANDOM_PHONE(),
      pickupAddress: `S2 pickup ${tag}`,
      dropoffAddress: `S2 dropoff ${tag}`,
      area: "S2",
      amount: 9,
      cashCollection: 9,
      deliveryFee: 0,
      notes: `${QA_NOTES} ${tag} injectCompany`,
      distributionMode: "MANUAL",
    },
    {
      userId: companyAdmin.id,
      role: "COMPANY_ADMIN",
      storeId: null,
      companyId: companyAdmin.companyId,
      branchId: companyAdmin.branchId,
    },
  );
  createdOrderIds.push(o3.id);
  steps.push({
    id: "ca_injected_company_ignored",
    ok: o3.companyId === companyAdmin.companyId,
    detail: { injected: otherCompany?.id, resultCompany: o3.companyId },
  });

  // --- 4) Cross-company storeId must fail
  let crossFailOk = true;
  let crossError = "";
  if (foreignStore) {
    try {
      const bad = await ordersService.create(
        {
          storeId: foreignStore.id,
          customerName: `S2QA ${tag} X`,
          customerPhone: RANDOM_PHONE(),
          pickupAddress: `S2 pickup ${tag}`,
          dropoffAddress: `S2 dropoff ${tag}`,
          area: "S2",
          amount: 1,
          cashCollection: 1,
          deliveryFee: 0,
          notes: `${QA_NOTES} should-not-persist`,
          distributionMode: "MANUAL",
        },
        {
          userId: companyAdmin.id,
          role: "COMPANY_ADMIN",
          storeId: null,
          companyId: companyAdmin.companyId,
          branchId: companyAdmin.branchId,
        },
      );
      createdOrderIds.push(bad.id);
      crossFailOk = false;
    } catch (e) {
      crossFailOk = e instanceof AppError && (e as AppError).code === "FORBIDDEN";
      if (!crossFailOk) crossError = e instanceof Error ? e.message : String(e);
    }
  } else {
    crossFailOk = true;
    crossError = "skipped — no other company with a store";
  }
  steps.push({
    id: "ca_foreign_store_rejected",
    ok: crossFailOk,
    detail: { foreignStoreId: foreignStore?.id, crossError },
  });

  // --- 5) Super admin: explicit storeId (no regression vs explicit-store path)
  const superUser = await prisma.user.findFirst({
    where: { role: UserRole.SUPER_ADMIN, isActive: true },
    select: { id: true, companyId: true, branchId: true },
  });
  if (!superUser) {
    steps.push({ id: "sa_explicit_storeid", ok: false, detail: { error: "no SUPER_ADMIN user" } });
  } else {
    const anyStore = await prisma.store.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, companyId: true, branchId: true },
    });
    if (!anyStore) {
      steps.push({ id: "sa_explicit_storeid", ok: false, detail: { error: "no active store" } });
    } else {
      const o4 = await ordersService.create(
        {
          storeId: anyStore.id,
          customerName: `S2QA ${tag} SA`,
          customerPhone: RANDOM_PHONE(),
          pickupAddress: "S2 SA pickup",
          dropoffAddress: "S2 SA dropoff",
          area: "S2",
          amount: 5,
          cashCollection: 5,
          deliveryFee: 0,
          notes: `${QA_NOTES} ${tag} superadmin`,
          distributionMode: "MANUAL",
        },
        {
          userId: superUser.id,
          role: "SUPER_ADMIN",
          storeId: null,
          companyId: null,
          branchId: null,
        },
      );
      createdOrderIds.push(o4.id);
      steps.push({
        id: "sa_explicit_storeid",
        ok: o4.storeId === anyStore.id && o4.companyId === anyStore.companyId,
        detail: { orderId: o4.id, storeId: o4.storeId },
      });
    }
  }

  // --- Cleanup: archive QA orders
  const archived = await prisma.order.updateMany({
    where: { id: { in: createdOrderIds } },
    data: { archivedAt: new Date() },
  });

  // eslint-disable-next-line no-console
  const report = {
    tag,
    companyName: company?.name,
    companyId: companyAdmin.companyId,
    stepResults: steps,
    allOk: steps.every((s) => s.ok),
    cleanup: { archivedCount: archived.count, orderIds: createdOrderIds, note: "orders archived; stores left intact" },
  };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(report, null, 2));
  if (!report.allOk) process.exitCode = 1;
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
