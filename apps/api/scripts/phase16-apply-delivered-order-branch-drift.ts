/**
 * Phase 1.6: guarded dry-run/apply for delivered order-branch drift cleanup (Lane A only).
 *
 * Safety:
 * - Default mode is dry-run.
 * - --apply requires ALLOW_PHASE16_DELIVERED_BRANCH_DRIFT_FIX=1.
 * - Hardcoded allowlist: delivered orders only.
 * - Refuses active/pending or any out-of-allowlist mutation.
 * - Only updates orders.branch_id -> stores.branch_id when all checks pass.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { OrderStatus, PrismaClient } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "..", ".env"), override: true });

const prisma = new PrismaClient();

type Mode = "dry-run" | "apply";

type ApprovedOrder = {
  orderId: string;
};

type Candidate = {
  orderId: string;
  status: OrderStatus;
  currentOrderBranchId: string;
  targetStoreBranchId: string | null;
  orderCompanyId: string;
  storeCompanyId: string;
  assignedCaptainId: string | null;
  assignedCaptainCompanyId: string | null;
  assignedCaptainBranchId: string | null;
  proposedUpdate: { branchId: string | null };
  riskNote: string;
  eligible: boolean;
  ineligibleReason: string | null;
};

const APPROVED_ALLOWLIST: ApprovedOrder[] = [
  { orderId: "cmocdztfb0001um6s9tn5p01r" },
  { orderId: "cmocbj5a00001umrkfw5fu3wc" },
];

function parseMode(argv: string[]): Mode {
  const hasApply = argv.includes("--apply");
  const hasDryRun = argv.includes("--dry-run");
  if (hasApply && hasDryRun) {
    throw new Error("Use only one mode: --dry-run or --apply");
  }
  if (hasApply) return "apply";
  return "dry-run";
}

async function buildCandidates(): Promise<Candidate[]> {
  const rows: Candidate[] = [];
  for (const approved of APPROVED_ALLOWLIST) {
    const order = await prisma.order.findUnique({
      where: { id: approved.orderId },
      select: {
        id: true,
        status: true,
        companyId: true,
        branchId: true,
        storeId: true,
        store: { select: { companyId: true, branchId: true } },
        assignedCaptainId: true,
        assignedCaptain: { select: { companyId: true, branchId: true } },
      },
    });

    if (!order) {
      rows.push({
        orderId: approved.orderId,
        status: OrderStatus.DELIVERED,
        currentOrderBranchId: "(missing)",
        targetStoreBranchId: null,
        orderCompanyId: "(missing)",
        storeCompanyId: "(missing)",
        assignedCaptainId: null,
        assignedCaptainCompanyId: null,
        assignedCaptainBranchId: null,
        proposedUpdate: { branchId: null },
        riskNote: "Allowlisted order not found; no update possible.",
        eligible: false,
        ineligibleReason: "order_not_found",
      });
      continue;
    }

    let ineligibleReason: string | null = null;
    if (order.status !== OrderStatus.DELIVERED) ineligibleReason = "order_status_not_delivered";
    if (order.companyId !== order.store.companyId) ineligibleReason = "order_store_company_mismatch";
    if (!order.store.branchId) ineligibleReason = "store_branch_missing";
    if (order.branchId === order.store.branchId) ineligibleReason = "already_aligned";
    if (order.assignedCaptain && order.assignedCaptain.companyId !== order.companyId) {
      ineligibleReason = "assigned_captain_company_mismatch";
    }
    if (
      order.status === OrderStatus.PENDING ||
      order.status === OrderStatus.CONFIRMED ||
      order.status === OrderStatus.ASSIGNED ||
      order.status === OrderStatus.ACCEPTED ||
      order.status === OrderStatus.PICKED_UP ||
      order.status === OrderStatus.IN_TRANSIT
    ) {
      ineligibleReason = "active_or_in_progress_order";
    }

    rows.push({
      orderId: order.id,
      status: order.status,
      currentOrderBranchId: order.branchId,
      targetStoreBranchId: order.store.branchId,
      orderCompanyId: order.companyId,
      storeCompanyId: order.store.companyId,
      assignedCaptainId: order.assignedCaptainId,
      assignedCaptainCompanyId: order.assignedCaptain?.companyId ?? null,
      assignedCaptainBranchId: order.assignedCaptain?.branchId ?? null,
      proposedUpdate: { branchId: order.store.branchId },
      riskNote:
        "Historical delivered row; branch alignment improves consistency. Keep company/store/captain/status unchanged.",
      eligible: ineligibleReason == null,
      ineligibleReason,
    });
  }
  return rows;
}

async function runApply(candidates: Candidate[]) {
  const toUpdate = candidates.filter((c) => c.eligible);
  const beforeAfter: Array<{
    orderId: string;
    status: OrderStatus;
    beforeBranchId: string;
    afterBranchId: string;
    companyId: string;
    storeId: string;
    assignedCaptainId: string | null;
  }> = [];

  await prisma.$transaction(async (tx) => {
    for (const row of toUpdate) {
      const fresh = await tx.order.findUnique({
        where: { id: row.orderId },
        select: {
          id: true,
          status: true,
          branchId: true,
          companyId: true,
          storeId: true,
          store: { select: { companyId: true, branchId: true } },
          assignedCaptainId: true,
          assignedCaptain: { select: { companyId: true } },
        },
      });
      if (!fresh) throw new Error(`Order disappeared during apply: ${row.orderId}`);
      if (fresh.status !== OrderStatus.DELIVERED) {
        throw new Error(`Order status drifted from DELIVERED: ${fresh.id}`);
      }
      if (fresh.companyId !== fresh.store.companyId) {
        throw new Error(`Order/store company mismatch for ${fresh.id}`);
      }
      if (!fresh.store.branchId) {
        throw new Error(`Store branch missing for ${fresh.id}`);
      }
      if (fresh.branchId === fresh.store.branchId) {
        throw new Error(`Order already aligned before apply: ${fresh.id}`);
      }
      if (fresh.assignedCaptain && fresh.assignedCaptain.companyId !== fresh.companyId) {
        throw new Error(`Assigned captain company mismatch for ${fresh.id}`);
      }

      await tx.order.update({
        where: { id: fresh.id },
        data: { branchId: fresh.store.branchId },
      });

      beforeAfter.push({
        orderId: fresh.id,
        status: fresh.status,
        beforeBranchId: fresh.branchId,
        afterBranchId: fresh.store.branchId,
        companyId: fresh.companyId,
        storeId: fresh.storeId,
        assignedCaptainId: fresh.assignedCaptainId,
      });
    }
  });

  const verification = await prisma.order.findMany({
    where: { id: { in: toUpdate.map((r) => r.orderId) } },
    select: {
      id: true,
      status: true,
      branchId: true,
      companyId: true,
      storeId: true,
      store: { select: { branchId: true, companyId: true } },
      assignedCaptainId: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const remainingDrift = await prisma.$queryRaw<Array<{ c: bigint }>>`
    SELECT COUNT(*)::bigint AS c
    FROM orders o
    JOIN stores s ON s.id = o.store_id
    WHERE o.archived_at IS NULL
      AND s.branch_id IS DISTINCT FROM o.branch_id
  `;

  return {
    attempted: toUpdate.length,
    beforeAfter,
    verification,
    postApplyChecks: {
      remainingOrderStoreBranchDrift: Number(remainingDrift[0]?.c ?? 0),
    },
  };
}

async function main() {
  const mode = parseMode(process.argv.slice(2));
  if (mode === "apply" && process.env.ALLOW_PHASE16_DELIVERED_BRANCH_DRIFT_FIX !== "1") {
    throw new Error("Refusing --apply without ALLOW_PHASE16_DELIVERED_BRANCH_DRIFT_FIX=1");
  }

  const candidates = await buildCandidates();
  const eligible = candidates.filter((c) => c.eligible);
  const ineligible = candidates.filter((c) => !c.eligible);

  const payload: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    mode,
    proposalOnly: mode === "dry-run",
    databaseWritesPerformed: false,
    safety: {
      applyRequested: mode === "apply",
      allowEnvPresent: process.env.ALLOW_PHASE16_DELIVERED_BRANCH_DRIFT_FIX === "1",
      allowlistSize: APPROVED_ALLOWLIST.length,
      allowlistOrderIds: APPROVED_ALLOWLIST.map((a) => a.orderId),
      pendingOrdersExplicitlyUntouched: ["cmocbided0001umq8jqn51amv", "cmocbh7tr0001um7whnyvpuh9"],
    },
    candidates,
    summary: {
      eligibleRows: eligible.length,
      wouldUpdateRows: eligible.length,
      ineligibleRows: ineligible.length,
      refusedRows: ineligible.map((r) => ({ orderId: r.orderId, reason: r.ineligibleReason })),
    },
  };

  if (mode === "apply") {
    const applyResult = await runApply(candidates);
    payload.applyResult = applyResult;
    payload.databaseWritesPerformed = true;
  }

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(payload, null, 2));
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
