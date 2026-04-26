/**
 * Phase 1.7.1: verify order tenant-injection guardrails (create/update).
 *
 * This script is QA-only:
 * - Creates temporary clearly-marked test orders.
 * - Verifies tenant derivation/override protections.
 * - Cleans created records at the end.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { OrderStatus, Prisma, PrismaClient } from "@prisma/client";
import { ordersService } from "../src/services/orders.service.js";
import { orderRepository } from "../src/repositories/order.repository.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "..", ".env"), override: true });

const prisma = new PrismaClient();

type CheckResult = {
  caseId: string;
  title: string;
  passed: boolean;
  details: Record<string, unknown>;
  error?: string;
};

function nowTag(): string {
  return new Date().toISOString();
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

async function createQaOrder(params: {
  storeId: string;
  actor: {
    userId: string;
    role: "SUPER_ADMIN" | "COMPANY_ADMIN";
    storeId: string | null;
    companyId: string | null;
    branchId: string | null;
  };
  injectedCompanyId?: string;
  injectedBranchId?: string;
  marker: string;
}) {
  return ordersService.create(
    {
      storeId: params.storeId,
      customerName: `QA Tenant Guard ${params.marker}`,
      customerPhone: `050${Math.floor(1000000 + Math.random() * 8999999)}`,
      pickupAddress: `QA pickup ${params.marker}`,
      dropoffAddress: `QA dropoff ${params.marker}`,
      area: "QA",
      amount: 10,
      cashCollection: 10,
      notes: `PHASE171_QA_${params.marker}_${nowTag()}`,
      distributionMode: "MANUAL",
      companyId: params.injectedCompanyId,
      branchId: params.injectedBranchId,
    },
    params.actor,
  );
}

async function main() {
  const checks: CheckResult[] = [];
  const createdOrderIds: string[] = [];
  let cleanupStatus: { attempted: boolean; deletedCount: number; ok: boolean; error?: string } = {
    attempted: false,
    deletedCount: 0,
    ok: false,
  };

  const companyAdmin = await prisma.user.findFirst({
    where: { role: "COMPANY_ADMIN", isActive: true, companyId: { not: null } },
    select: { id: true, companyId: true, branchId: true },
    orderBy: { createdAt: "asc" },
  });
  if (!companyAdmin?.companyId) {
    throw new Error("No active COMPANY_ADMIN with company scope found for phase171 verification.");
  }

  const stores = await prisma.store.findMany({
    where: { isActive: true, companyId: companyAdmin.companyId },
    select: { id: true, companyId: true, branchId: true },
    orderBy: { createdAt: "asc" },
  });
  if (stores.length === 0) {
    throw new Error("No active stores found in COMPANY_ADMIN company scope.");
  }
  const primaryStore = stores[0]!;

  const anyActiveStore = await prisma.store.findFirst({
    where: { isActive: true, id: { not: primaryStore.id } },
    select: { id: true, companyId: true, branchId: true },
    orderBy: { createdAt: "asc" },
  });
  const alternateStore = anyActiveStore ?? null;
  if (!alternateStore) {
    throw new Error("Could not resolve alternate store for store-change verification.");
  }

  const injectedCompanyId = alternateStore.companyId;
  const injectedBranchId = alternateStore.branchId;

  // Case 1: create with wrong companyId injection.
  try {
    const created = await createQaOrder({
      storeId: primaryStore.id,
      actor: {
        userId: companyAdmin.id,
        role: "COMPANY_ADMIN",
        storeId: null,
        companyId: companyAdmin.companyId,
        branchId: companyAdmin.branchId,
      },
      injectedCompanyId,
      marker: `C1_${randomSuffix()}`,
    });
    createdOrderIds.push(created.id);
    checks.push({
      caseId: "case_1_create_injected_company",
      title: "Create with injected companyId uses store-derived companyId",
      passed: created.companyId === primaryStore.companyId,
      details: {
        orderId: created.id,
        injectedCompanyId,
        persistedCompanyId: created.companyId,
        expectedCompanyId: primaryStore.companyId,
      },
    });
  } catch (error) {
    checks.push({
      caseId: "case_1_create_injected_company",
      title: "Create with injected companyId uses store-derived companyId",
      passed: false,
      details: {},
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Case 2: create with wrong branchId injection.
  try {
    const created = await createQaOrder({
      storeId: primaryStore.id,
      actor: {
        userId: companyAdmin.id,
        role: "COMPANY_ADMIN",
        storeId: null,
        companyId: companyAdmin.companyId,
        branchId: companyAdmin.branchId,
      },
      injectedBranchId,
      marker: `C2_${randomSuffix()}`,
    });
    createdOrderIds.push(created.id);
    checks.push({
      caseId: "case_2_create_injected_branch",
      title: "Create with injected branchId uses store-derived branchId",
      passed: created.branchId === primaryStore.branchId,
      details: {
        orderId: created.id,
        injectedBranchId,
        persistedBranchId: created.branchId,
        expectedBranchId: primaryStore.branchId,
      },
    });
  } catch (error) {
    checks.push({
      caseId: "case_2_create_injected_branch",
      title: "Create with injected branchId uses store-derived branchId",
      passed: false,
      details: {},
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Base order for update cases 3+4.
  let baseOrderId: string | null = null;
  try {
    const base = await createQaOrder({
      storeId: primaryStore.id,
      actor: {
        userId: companyAdmin.id,
        role: "COMPANY_ADMIN",
        storeId: null,
        companyId: companyAdmin.companyId,
        branchId: companyAdmin.branchId,
      },
      marker: `BASE_${randomSuffix()}`,
    });
    createdOrderIds.push(base.id);
    baseOrderId = base.id;
  } catch (error) {
    checks.push({
      caseId: "case_base_order_for_updates",
      title: "Base order creation for update verification",
      passed: false,
      details: {},
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Case 3: update without store change but direct tenant override.
  if (!baseOrderId) {
    checks.push({
      caseId: "case_3_update_direct_override_without_store_change",
      title: "Update without store change rejects/ignores direct tenant override",
      passed: false,
      details: { reason: "base_order_missing" },
    });
  } else {
    try {
      const before = await prisma.order.findUnique({
        where: { id: baseOrderId },
        select: { id: true, companyId: true, branchId: true },
      });
      if (!before) throw new Error("Base order missing before case 3");

      let rejected = false;
      try {
        await orderRepository.update(
          baseOrderId,
          {
            company: { connect: { id: injectedCompanyId } },
            branch: { connect: { id: injectedBranchId } },
          } as Prisma.OrderUpdateInput,
        );
      } catch {
        rejected = true;
      }

      const after = await prisma.order.findUnique({
        where: { id: baseOrderId },
        select: { id: true, companyId: true, branchId: true },
      });
      const unchanged = after && before.companyId === after.companyId && before.branchId === after.branchId;
      checks.push({
        caseId: "case_3_update_direct_override_without_store_change",
        title: "Update without store change rejects/ignores direct tenant override",
        passed: rejected && Boolean(unchanged),
        details: {
          orderId: baseOrderId,
          rejected,
          before,
          after,
        },
      });
    } catch (error) {
      checks.push({
        caseId: "case_3_update_direct_override_without_store_change",
        title: "Update without store change rejects/ignores direct tenant override",
        passed: false,
        details: { orderId: baseOrderId },
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Case 4: update with store change + manual tenant override attempt.
  if (!baseOrderId) {
    checks.push({
      caseId: "case_4_update_with_store_change",
      title: "Update with store change recalculates tenant from new store",
      passed: false,
      details: { reason: "base_order_missing" },
    });
  } else {
    try {
      const updated = await orderRepository.update(
        baseOrderId,
        {
          store: { connect: { id: alternateStore.id } },
          company: { connect: { id: primaryStore.companyId } },
          branch: { connect: { id: primaryStore.branchId } },
        } as Prisma.OrderUpdateInput,
      );
      checks.push({
        caseId: "case_4_update_with_store_change",
        title: "Update with store change recalculates tenant from new store",
        passed:
          updated.storeId === alternateStore.id &&
          updated.companyId === alternateStore.companyId &&
          updated.branchId === alternateStore.branchId,
        details: {
          orderId: updated.id,
          newStoreId: updated.storeId,
          persistedCompanyId: updated.companyId,
          persistedBranchId: updated.branchId,
          expectedCompanyId: alternateStore.companyId,
          expectedBranchId: alternateStore.branchId,
        },
      });
    } catch (error) {
      checks.push({
        caseId: "case_4_update_with_store_change",
        title: "Update with store change recalculates tenant from new store",
        passed: false,
        details: { orderId: baseOrderId, targetStoreId: alternateStore.id },
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Case 5: non-super-admin injection attempt.
  try {
    const created = await createQaOrder({
      storeId: primaryStore.id,
      actor: {
        userId: companyAdmin.id,
        role: "COMPANY_ADMIN",
        storeId: null,
        companyId: companyAdmin.companyId,
        branchId: companyAdmin.branchId,
      },
      injectedCompanyId,
      injectedBranchId,
      marker: `C5_${randomSuffix()}`,
    });
    createdOrderIds.push(created.id);
    checks.push({
      caseId: "case_5_non_super_admin_injection",
      title: "Non-super-admin cannot inject tenant values",
      passed: created.companyId === primaryStore.companyId && created.branchId === primaryStore.branchId,
      details: {
        orderId: created.id,
        actorUserId: companyAdmin.id,
        actorCompanyId: companyAdmin.companyId,
        injectedCompanyId,
        injectedBranchId,
        persistedCompanyId: created.companyId,
        persistedBranchId: created.branchId,
        expectedCompanyId: primaryStore.companyId,
        expectedBranchId: primaryStore.branchId,
      },
    });
  } catch (error) {
    checks.push({
      caseId: "case_5_non_super_admin_injection",
      title: "Non-super-admin cannot inject tenant values",
      passed: false,
      details: { actorUserId: companyAdmin.id },
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Cleanup temporary records.
  cleanupStatus.attempted = true;
  try {
    const deleted = await prisma.order.deleteMany({
      where: { id: { in: createdOrderIds }, status: OrderStatus.PENDING },
    });
    cleanupStatus = {
      attempted: true,
      deletedCount: deleted.count,
      ok: deleted.count === createdOrderIds.length,
      ...(deleted.count === createdOrderIds.length
        ? {}
        : { error: `Deleted ${deleted.count} of ${createdOrderIds.length} created orders.` }),
    };
  } catch (error) {
    cleanupStatus = {
      attempted: true,
      deletedCount: 0,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const passedChecks = checks.filter((c) => c.passed).length;
  const failedChecks = checks.length - passedChecks;

  const payload = {
    generatedAt: new Date().toISOString(),
    totalChecks: checks.length,
    passedChecks,
    failedChecks,
    checks,
    createdTestRecords: createdOrderIds,
    cleanupStatus,
    databaseWritesPerformed: createdOrderIds.length > 0,
    phasePass: failedChecks === 0 && cleanupStatus.ok,
  };

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(payload, null, 2));
  if (!payload.phasePass) {
    process.exitCode = 1;
  }
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
