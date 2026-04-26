/**
 * Phase 1.5 (read-only): review order/store branch drift rows and propose safe cleanup actions.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import { config } from "dotenv";
import { OrderStatus, PrismaClient } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "..");
config({ path: path.resolve(apiRoot, ".env"), override: true });

const prisma = new PrismaClient();

type ProposedAction = "update_order_branch_to_store_branch" | "manual_review" | "no_action";
type Confidence = "high" | "medium" | "low" | "none";

type ReviewRow = {
  orderId: string;
  orderStatus: OrderStatus;
  orderCreatedAt: string;
  orderCompanyId: string;
  orderBranchId: string;
  storeId: string;
  storeCompanyId: string;
  storeBranchId: string | null;
  assignedCaptainId: string | null;
  assignedCaptainCompanyId: string | null;
  assignedCaptainBranchId: string | null;
  orderStoreCompanyMatch: boolean;
  assignedCaptainMatchesOrderTenant: boolean | null;
  proposedBranchId: string | null;
  proposedAction: ProposedAction;
  confidence: Confidence;
  reason: string;
  riskNote: string;
};

const ACTIVE_OR_IN_PROGRESS = new Set<OrderStatus>([
  "PENDING",
  "CONFIRMED",
  "ASSIGNED",
  "ACCEPTED",
  "PICKED_UP",
  "IN_TRANSIT",
]);

function csvEscape(value: string | number | boolean | null): string {
  if (value == null) return "";
  const raw = String(value);
  if (raw.includes(",") || raw.includes('"') || raw.includes("\n")) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function rowsToCsv(rows: ReviewRow[]): string {
  const header = [
    "orderId",
    "orderStatus",
    "orderCreatedAt",
    "orderCompanyId",
    "orderBranchId",
    "storeId",
    "storeCompanyId",
    "storeBranchId",
    "assignedCaptainId",
    "assignedCaptainCompanyId",
    "assignedCaptainBranchId",
    "orderStoreCompanyMatch",
    "assignedCaptainMatchesOrderTenant",
    "proposedBranchId",
    "proposedAction",
    "confidence",
    "reason",
    "riskNote",
  ];
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.orderId,
        row.orderStatus,
        row.orderCreatedAt,
        row.orderCompanyId,
        row.orderBranchId,
        row.storeId,
        row.storeCompanyId,
        row.storeBranchId,
        row.assignedCaptainId,
        row.assignedCaptainCompanyId,
        row.assignedCaptainBranchId,
        row.orderStoreCompanyMatch,
        row.assignedCaptainMatchesOrderTenant,
        row.proposedBranchId,
        row.proposedAction,
        row.confidence,
        row.reason,
        row.riskNote,
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

function evaluateRow(input: {
  orderStatus: OrderStatus;
  orderCompanyId: string;
  storeCompanyId: string;
  storeBranchId: string | null;
  assignedCaptainId: string | null;
  assignedCaptainCompanyId: string | null;
  assignedCaptainBranchId: string | null;
  orderBranchId: string;
  archivedAt: Date | null;
}): Pick<
  ReviewRow,
  | "orderStoreCompanyMatch"
  | "assignedCaptainMatchesOrderTenant"
  | "proposedBranchId"
  | "proposedAction"
  | "confidence"
  | "reason"
  | "riskNote"
> {
  const orderStoreCompanyMatch = input.orderCompanyId === input.storeCompanyId;
  const assignedCaptainMatchesOrderTenant =
    input.assignedCaptainId == null
      ? null
      : input.assignedCaptainCompanyId === input.orderCompanyId &&
        input.assignedCaptainBranchId === input.orderBranchId;

  if (!orderStoreCompanyMatch) {
    return {
      orderStoreCompanyMatch,
      assignedCaptainMatchesOrderTenant,
      proposedBranchId: null,
      proposedAction: "manual_review",
      confidence: "none",
      reason: "Order and store company mismatch detected.",
      riskNote: "Cross-company mismatch must be investigated manually; no automatic update is safe.",
    };
  }

  if (!input.storeBranchId) {
    return {
      orderStoreCompanyMatch,
      assignedCaptainMatchesOrderTenant,
      proposedBranchId: null,
      proposedAction: "manual_review",
      confidence: "none",
      reason: "Store branch is missing; cannot infer a safe target branch.",
      riskNote: "Missing store branch blocks deterministic branch correction.",
    };
  }

  const assignedCaptainBranchConflict =
    input.assignedCaptainId != null &&
    input.assignedCaptainCompanyId === input.orderCompanyId &&
    input.assignedCaptainBranchId != null &&
    input.assignedCaptainBranchId !== input.storeBranchId;

  if (assignedCaptainBranchConflict) {
    return {
      orderStoreCompanyMatch,
      assignedCaptainMatchesOrderTenant,
      proposedBranchId: input.storeBranchId,
      proposedAction: "manual_review",
      confidence: "medium",
      reason: "Assigned captain is in same company but on a different branch than the store target branch.",
      riskNote: "Potential operational impact for captain assignment history; confirm branch policy before update.",
    };
  }

  const isHistorical =
    input.archivedAt != null || input.orderStatus === "DELIVERED" || input.orderStatus === "CANCELLED";
  if (!isHistorical || ACTIVE_OR_IN_PROGRESS.has(input.orderStatus)) {
    return {
      orderStoreCompanyMatch,
      assignedCaptainMatchesOrderTenant,
      proposedBranchId: input.storeBranchId,
      proposedAction: "manual_review",
      confidence: "low",
      reason: "Order appears active/in-progress; avoid branch mutation without explicit safety proof.",
      riskNote: "Active order branch changes may affect live operations and assignment flows.",
    };
  }

  return {
    orderStoreCompanyMatch,
    assignedCaptainMatchesOrderTenant,
    proposedBranchId: input.storeBranchId,
    proposedAction: "update_order_branch_to_store_branch",
    confidence: "high",
    reason: "Order/store company matches and order is historical; aligning order branch to store branch is low risk.",
    riskNote: "Historical data consistency update; still apply via guarded dry-run/apply flow later.",
  };
}

async function main() {
  const driftRows = await prisma.$queryRaw<
    Array<{
      order_id: string;
      order_status: OrderStatus;
      order_created_at: Date;
      order_archived_at: Date | null;
      order_company_id: string;
      order_branch_id: string;
      store_id: string;
      store_company_id: string;
      store_branch_id: string | null;
      assigned_captain_id: string | null;
      assigned_captain_company_id: string | null;
      assigned_captain_branch_id: string | null;
    }>
  >`
    SELECT
      o.id AS order_id,
      o.status AS order_status,
      o.created_at AS order_created_at,
      o.archived_at AS order_archived_at,
      o.company_id AS order_company_id,
      o.branch_id AS order_branch_id,
      o.store_id AS store_id,
      s.company_id AS store_company_id,
      s.branch_id AS store_branch_id,
      o.assigned_captain_id AS assigned_captain_id,
      c.company_id AS assigned_captain_company_id,
      c.branch_id AS assigned_captain_branch_id
    FROM orders o
    JOIN stores s ON s.id = o.store_id
    LEFT JOIN captains c ON c.id = o.assigned_captain_id
    WHERE o.archived_at IS NULL
      AND s.branch_id IS DISTINCT FROM o.branch_id
    ORDER BY o.created_at DESC
  `;

  const reviews: ReviewRow[] = driftRows.map((row) => {
    const evaluated = evaluateRow({
      orderStatus: row.order_status,
      orderCompanyId: row.order_company_id,
      storeCompanyId: row.store_company_id,
      storeBranchId: row.store_branch_id,
      assignedCaptainId: row.assigned_captain_id,
      assignedCaptainCompanyId: row.assigned_captain_company_id,
      assignedCaptainBranchId: row.assigned_captain_branch_id,
      orderBranchId: row.order_branch_id,
      archivedAt: row.order_archived_at,
    });
    return {
      orderId: row.order_id,
      orderStatus: row.order_status,
      orderCreatedAt: row.order_created_at.toISOString(),
      orderCompanyId: row.order_company_id,
      orderBranchId: row.order_branch_id,
      storeId: row.store_id,
      storeCompanyId: row.store_company_id,
      storeBranchId: row.store_branch_id,
      assignedCaptainId: row.assigned_captain_id,
      assignedCaptainCompanyId: row.assigned_captain_company_id,
      assignedCaptainBranchId: row.assigned_captain_branch_id,
      ...evaluated,
    };
  });

  const byAction = reviews.reduce<Record<ProposedAction, number>>(
    (acc, row) => {
      acc[row.proposedAction] += 1;
      return acc;
    },
    { update_order_branch_to_store_branch: 0, manual_review: 0, no_action: 0 },
  );
  const byConfidence = reviews.reduce<Record<Confidence, number>>(
    (acc, row) => {
      acc[row.confidence] += 1;
      return acc;
    },
    { high: 0, medium: 0, low: 0, none: 0 },
  );

  const affectedActiveOrInProgress = reviews.filter((r) => ACTIVE_OR_IN_PROGRESS.has(r.orderStatus)).length;
  const captainTenantConflicts = reviews.filter((r) => r.assignedCaptainMatchesOrderTenant === false).length;

  const output = {
    generatedAt: new Date().toISOString(),
    proposalOnly: true,
    databaseWritesPerformed: false,
    driftRowCount: reviews.length,
    summary: {
      byAction,
      byConfidence,
      affectedActiveOrInProgress,
      captainTenantConflicts,
    },
    reviews,
  };

  const tmpDir = path.resolve(apiRoot, "tmp");
  await mkdir(tmpDir, { recursive: true });
  const jsonPath = path.resolve(tmpDir, "phase15-order-store-branch-drift-review.json");
  const csvPath = path.resolve(tmpDir, "phase15-order-store-branch-drift-review.csv");
  await writeFile(jsonPath, JSON.stringify(output, null, 2), "utf8");
  await writeFile(csvPath, rowsToCsv(reviews), "utf8");

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        ...output,
        artifacts: {
          jsonPath: path.relative(apiRoot, jsonPath).replaceAll("\\", "/"),
          csvPath: path.relative(apiRoot, csvPath).replaceAll("\\", "/"),
        },
      },
      null,
      2,
    ),
  );
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
