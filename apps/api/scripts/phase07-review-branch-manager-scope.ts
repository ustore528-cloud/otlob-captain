/**
 * Phase 0.7 (read-only): manual review for remaining BRANCH_MANAGER scope gaps.
 * No DB writes.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { PrismaClient, UserRole } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "..", ".env"), override: true });

const prisma = new PrismaClient();

type Confidence = "high" | "medium" | "low" | "none";
type ProposedAction =
  | "assign_company_and_branch"
  | "convert_role"
  | "deactivate_user"
  | "manual_review"
  | "no_action";

type ReviewRow = {
  userId: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  currentCompanyId: string | null;
  currentBranchId: string | null;
  ownedStoreCount: number;
  ownedStoreIds: string[];
  ownedStoreCompanyIds: string[];
  ownedStoreBranchIds: string[];
  createdStoreCount: number;
  createdCaptainCount: number;
  createdCaptainCompanyIds: string[];
  createdCaptainBranchIds: string[];
  createdOrderCount: number;
  createdOrderCompanyIds: string[];
  createdOrderBranchIds: string[];
  assignedBranchRelation: { branchId: string; branchCompanyId: string } | null;
  activityLogCount: number;
  latestActivityAction: string | null;
  latestActivityAt: string | null;
  possibleCompanyIdCandidate: string | null;
  possibleBranchIdCandidate: string | null;
  inferenceSource: string;
  confidence: Confidence;
  proposedAction: ProposedAction;
  reason: string;
  riskNote: string;
};

const TARGET_EMAILS = ["ad2min1@admin.com", "ustore5228@gmail.com"];

function uniq(values: string[]): string[] {
  return [...new Set(values)];
}

function singleOrNull(values: string[]): string | null {
  return values.length === 1 ? values[0] ?? null : null;
}

function hasOperationalFootprint(row: {
  activityLogCount: number;
  createdOrderCount: number;
  createdCaptainCount: number;
  createdStoreCount: number;
}): boolean {
  return (
    row.activityLogCount > 0 ||
    row.createdOrderCount > 0 ||
    row.createdCaptainCount > 0 ||
    row.createdStoreCount > 0
  );
}

async function main() {
  const users = await prisma.user.findMany({
    where: {
      role: UserRole.BRANCH_MANAGER,
      isActive: true,
      email: { in: TARGET_EMAILS },
    },
    select: {
      id: true,
      email: true,
      phone: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      companyId: true,
      branchId: true,
      branch: { select: { id: true, companyId: true } },
      ownedStores: {
        where: { isActive: true },
        select: { id: true, companyId: true, branchId: true },
      },
      createdCaptains: {
        select: { id: true, companyId: true, branchId: true },
      },
      ordersCreated: {
        select: { id: true, companyId: true, branchId: true },
      },
      activityLogs: {
        select: { id: true, action: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 200,
      },
    },
    orderBy: { email: "asc" },
  });

  const rows: ReviewRow[] = [];

  for (const u of users) {
    const storeCompanyIds = uniq(u.ownedStores.map((s) => s.companyId));
    const storeBranchIds = uniq(u.ownedStores.map((s) => s.branchId));
    const captainCompanyIds = uniq(u.createdCaptains.map((c) => c.companyId));
    const captainBranchIds = uniq(u.createdCaptains.map((c) => c.branchId));
    const orderCompanyIds = uniq(u.ordersCreated.map((o) => o.companyId));
    const orderBranchIds = uniq(u.ordersCreated.map((o) => o.branchId));

    const candidateCompany = singleOrNull(
      uniq([...storeCompanyIds, ...captainCompanyIds, ...orderCompanyIds].filter(Boolean)),
    );
    const candidateBranch = singleOrNull(
      uniq([...storeBranchIds, ...captainBranchIds, ...orderBranchIds].filter(Boolean)),
    );

    let inferenceSource = "no_reliable_relation";
    let confidence: Confidence = "none";
    let proposedAction: ProposedAction = "manual_review";
    let reason = "No verified single company+branch relation detected.";
    let riskNote = "Unsafe to auto-assign tenant scope without validated relation.";

    if (u.branch && !u.companyId && !u.branchId) {
      inferenceSource = "branch_fk_present";
      confidence = "high";
      proposedAction = "assign_company_and_branch";
      reason = "User has branch FK that resolves to one branch+company.";
      riskNote = "Low risk if branch FK is intentional and active.";
    } else if (candidateCompany && candidateBranch) {
      inferenceSource = "operational_relations_consensus";
      confidence = "medium";
      proposedAction = "manual_review";
      reason = "Operational records point to one company+branch but no direct user tenant linkage.";
      riskNote = "Requires human confirmation before assignment.";
    } else if (!hasOperationalFootprint({
      activityLogCount: u.activityLogs.length,
      createdOrderCount: u.ordersCreated.length,
      createdCaptainCount: u.createdCaptains.length,
      createdStoreCount: u.ownedStores.length,
    })) {
      inferenceSource = "no_activity_no_relation";
      confidence = "none";
      proposedAction = "deactivate_user";
      reason = "Legacy/test-like account: no activity and no reliable tenant relation.";
      riskNote = "Sensitive action; require human approval before deactivation.";
    }

    const lastLogin = u.activityLogs.find((a) => a.action === "AUTH_LOGIN") ?? null;
    const latestActivity = u.activityLogs[0] ?? null;

    rows.push({
      userId: u.id,
      email: u.email,
      phone: u.phone ?? null,
      isActive: u.isActive,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
      lastLoginAt: lastLogin?.createdAt.toISOString() ?? null,
      currentCompanyId: u.companyId,
      currentBranchId: u.branchId,
      ownedStoreCount: u.ownedStores.length,
      ownedStoreIds: u.ownedStores.map((s) => s.id),
      ownedStoreCompanyIds: storeCompanyIds,
      ownedStoreBranchIds: storeBranchIds,
      createdStoreCount: u.ownedStores.length,
      createdCaptainCount: u.createdCaptains.length,
      createdCaptainCompanyIds: captainCompanyIds,
      createdCaptainBranchIds: captainBranchIds,
      createdOrderCount: u.ordersCreated.length,
      createdOrderCompanyIds: orderCompanyIds,
      createdOrderBranchIds: orderBranchIds,
      assignedBranchRelation: u.branch
        ? { branchId: u.branch.id, branchCompanyId: u.branch.companyId }
        : null,
      activityLogCount: u.activityLogs.length,
      latestActivityAction: latestActivity?.action ?? null,
      latestActivityAt: latestActivity?.createdAt.toISOString() ?? null,
      possibleCompanyIdCandidate: u.branch?.companyId ?? candidateCompany,
      possibleBranchIdCandidate: u.branch?.id ?? candidateBranch,
      inferenceSource,
      confidence,
      proposedAction,
      reason,
      riskNote,
    });
  }

  const byAction = rows.reduce<Record<ProposedAction, number>>(
    (acc, r) => {
      acc[r.proposedAction] += 1;
      return acc;
    },
    {
      assign_company_and_branch: 0,
      convert_role: 0,
      deactivate_user: 0,
      manual_review: 0,
      no_action: 0,
    },
  );
  const byConfidence = rows.reduce<Record<Confidence, number>>(
    (acc, r) => {
      acc[r.confidence] += 1;
      return acc;
    },
    { high: 0, medium: 0, low: 0, none: 0 },
  );

  const payload = {
    generatedAt: new Date().toISOString(),
    proposalOnly: true,
    databaseWritesPerformed: false,
    targetEmails: TARGET_EMAILS,
    foundUsers: rows.length,
    summary: { byAction, byConfidence },
    reviews: rows,
  };

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
