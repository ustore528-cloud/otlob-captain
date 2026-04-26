/**
 * Phase 0.5 (proposal only): generate tenant scope backfill proposal artifacts.
 * - No DB writes.
 * - No runtime behavior changes.
 * - Output only: JSON + CSV under apps/api/tmp.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import { config } from "dotenv";
import { PrismaClient, UserRole } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "..", ".env"), override: true });
const apiRoot = path.resolve(__dirname, "..");

const prisma = new PrismaClient();

type Confidence = "high" | "medium" | "low" | "none";
type ProposedAction = "assign_company" | "assign_branch" | "deactivate_user" | "manual_review" | "no_action";

type Candidate = {
  companyId: string | null;
  branchId: string | null;
  source: string;
  confidence: Confidence;
  reason: string;
  riskNote: string;
};

type ProposalRow = {
  userId: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  currentCompanyId: string | null;
  currentBranchId: string | null;
  relatedCaptainId: string | null;
  relatedCaptainCompanyId: string | null;
  relatedCaptainBranchId: string | null;
  relatedOwnedStoreCount: number;
  relatedOwnedStoreCompanyIds: string[];
  relatedOwnedStoreBranchIds: string[];
  relatedBranchRecordCompanyId: string | null;
  possibleInferredCompanyId: string | null;
  possibleInferredBranchId: string | null;
  inferenceSource: string;
  confidence: Confidence;
  proposedAction: ProposedAction;
  reason: string;
  riskNote: string;
};

const NEEDS_COMPANY = new Set<UserRole>([
  UserRole.COMPANY_ADMIN,
  UserRole.BRANCH_MANAGER,
  UserRole.DISPATCHER,
  UserRole.STORE_ADMIN,
  UserRole.STORE_USER,
  UserRole.CAPTAIN_SUPERVISOR,
]);

const NEEDS_BRANCH = new Set<UserRole>([UserRole.BRANCH_MANAGER, UserRole.CAPTAIN_SUPERVISOR]);

function unique<T>(vals: T[]): T[] {
  return [...new Set(vals)];
}

function pickSingleOrNull(values: string[]): string | null {
  return values.length === 1 ? values[0] ?? null : null;
}

function escCsvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (s.includes('"') || s.includes(",") || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowsToCsv(rows: ProposalRow[]): string {
  const headers: Array<keyof ProposalRow> = [
    "userId",
    "email",
    "phone",
    "role",
    "currentCompanyId",
    "currentBranchId",
    "relatedCaptainId",
    "relatedCaptainCompanyId",
    "relatedCaptainBranchId",
    "relatedOwnedStoreCount",
    "relatedOwnedStoreCompanyIds",
    "relatedOwnedStoreBranchIds",
    "relatedBranchRecordCompanyId",
    "possibleInferredCompanyId",
    "possibleInferredBranchId",
    "inferenceSource",
    "confidence",
    "proposedAction",
    "reason",
    "riskNote",
  ];
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(
      headers
        .map((h) => {
          const v = row[h];
          if (Array.isArray(v)) return escCsvCell(v.join("|"));
          return escCsvCell(v);
        })
        .join(","),
    );
  }
  return lines.join("\n");
}

function scoreCandidate(c: Candidate): number {
  if (c.confidence === "high") return 4;
  if (c.confidence === "medium") return 3;
  if (c.confidence === "low") return 2;
  return 1;
}

function bestCandidate(candidates: Candidate[]): Candidate {
  return candidates.sort((a, b) => scoreCandidate(b) - scoreCandidate(a))[0]!;
}

function decideAction(
  role: UserRole,
  currentCompanyId: string | null,
  currentBranchId: string | null,
  selected: Candidate,
): ProposedAction {
  if (selected.confidence === "none") {
    return "manual_review";
  }

  const needsCompany = NEEDS_COMPANY.has(role);
  const needsBranch = NEEDS_BRANCH.has(role);

  if (needsCompany && !currentCompanyId && selected.companyId && selected.confidence === "high") {
    return "assign_company";
  }
  if (needsBranch && !currentBranchId && selected.branchId && selected.confidence === "high") {
    return "assign_branch";
  }

  if (selected.confidence === "high" && !needsCompany && !needsBranch) {
    return "no_action";
  }

  return "manual_review";
}

async function main() {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      email: true,
      phone: true,
      role: true,
      companyId: true,
      branchId: true,
      captain: { select: { id: true, companyId: true, branchId: true } },
      ownedStores: { where: { isActive: true }, select: { id: true, companyId: true, branchId: true } },
      branch: { select: { id: true, companyId: true } },
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });

  const affected = users.filter((u) => {
    const missingCompany = NEEDS_COMPANY.has(u.role) && !u.companyId;
    const missingBranch = NEEDS_BRANCH.has(u.role) && !u.branchId;
    return missingCompany || missingBranch;
  });

  const proposals: ProposalRow[] = [];

  for (const u of affected) {
    const storeCompanyIds = unique(u.ownedStores.map((s) => s.companyId).filter(Boolean));
    const storeBranchIds = unique(u.ownedStores.map((s) => s.branchId).filter(Boolean));
    const captainCompanyId = u.captain?.companyId ?? null;
    const captainBranchId = u.captain?.branchId ?? null;
    const branchRecordCompanyId = u.branch?.companyId ?? null;

    const candidates: Candidate[] = [];

    // Captain relation inference (strong, direct).
    if (captainCompanyId) {
      candidates.push({
        companyId: captainCompanyId,
        branchId: captainBranchId,
        source: "captain_profile_relation",
        confidence: captainBranchId ? "high" : "medium",
        reason: "User has linked captain profile with tenant fields.",
        riskNote: captainBranchId
          ? "Low risk: direct relation."
          : "Branch missing in captain profile; company-only inference.",
      });
    }

    // Active owned store inference (strong for store roles).
    const singleStoreCompany = pickSingleOrNull(storeCompanyIds);
    const singleStoreBranch = pickSingleOrNull(storeBranchIds);
    if (singleStoreCompany) {
      candidates.push({
        companyId: singleStoreCompany,
        branchId: singleStoreBranch,
        source: "active_owned_store_relation",
        confidence: singleStoreBranch ? "high" : "medium",
        reason: "User owns active store(s) with tenant linkage.",
        riskNote:
          storeCompanyIds.length > 1 || storeBranchIds.length > 1
            ? "Multiple store tenants detected; avoid auto-assign."
            : "Direct store ownership relation.",
      });
    } else if (storeCompanyIds.length > 1 || storeBranchIds.length > 1) {
      candidates.push({
        companyId: null,
        branchId: null,
        source: "active_owned_store_relation_conflict",
        confidence: "low",
        reason: "User owns stores spanning multiple companies/branches.",
        riskNote: "Unsafe to auto-assign single tenant scope.",
      });
    }

    // Existing user.branch relation implies company (when branchId exists but companyId missing).
    if (u.branchId && branchRecordCompanyId) {
      candidates.push({
        companyId: branchRecordCompanyId,
        branchId: u.branchId,
        source: "user_branch_fk_relation",
        confidence: "high",
        reason: "Branch FK exists and resolves to company.",
        riskNote: "Low risk if branch is still valid/active.",
      });
    }

    // Existing company + role branch required + only one active branch in company => medium proposal only.
    if (u.companyId && NEEDS_BRANCH.has(u.role) && !u.branchId) {
      const branches = await prisma.branch.findMany({
        where: { companyId: u.companyId, isActive: true },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      });
      if (branches.length === 1) {
        candidates.push({
          companyId: u.companyId,
          branchId: branches[0]?.id ?? null,
          source: "single_active_branch_in_company",
          confidence: "medium",
          reason: "Exactly one active branch exists for user's company.",
          riskNote: "Still requires manual review per policy before assignment.",
        });
      }
    }

    if (candidates.length === 0) {
      candidates.push({
        companyId: null,
        branchId: null,
        source: "no_reliable_relation",
        confidence: "none",
        reason: "No verified tenant relation found.",
        riskNote: "High risk to auto-assign. Manual review required.",
      });
    }

    const selected = bestCandidate(candidates);
    const action = decideAction(u.role, u.companyId, u.branchId, selected);

    proposals.push({
      userId: u.id,
      email: u.email,
      phone: u.phone ?? null,
      role: u.role,
      currentCompanyId: u.companyId,
      currentBranchId: u.branchId,
      relatedCaptainId: u.captain?.id ?? null,
      relatedCaptainCompanyId: captainCompanyId,
      relatedCaptainBranchId: captainBranchId,
      relatedOwnedStoreCount: u.ownedStores.length,
      relatedOwnedStoreCompanyIds: storeCompanyIds,
      relatedOwnedStoreBranchIds: storeBranchIds,
      relatedBranchRecordCompanyId: branchRecordCompanyId,
      possibleInferredCompanyId: selected.companyId,
      possibleInferredBranchId: selected.branchId,
      inferenceSource: selected.source,
      confidence: selected.confidence,
      proposedAction: action,
      reason: selected.reason,
      riskNote: selected.riskNote,
    });
  }

  const actionSummary = proposals.reduce<Record<ProposedAction, number>>(
    (acc, p) => {
      acc[p.proposedAction] += 1;
      return acc;
    },
    {
      assign_company: 0,
      assign_branch: 0,
      deactivate_user: 0,
      manual_review: 0,
      no_action: 0,
    },
  );

  const confidenceSummary = proposals.reduce<Record<Confidence, number>>(
    (acc, p) => {
      acc[p.confidence] += 1;
      return acc;
    },
    { high: 0, medium: 0, low: 0, none: 0 },
  );

  const output = {
    generatedAt: new Date().toISOString(),
    proposalOnly: true,
    databaseWritesPerformed: false,
    affectedUsers: proposals.length,
    actionSummary,
    confidenceSummary,
    proposals,
  };

  const tmpDir = path.resolve(apiRoot, "tmp");
  await mkdir(tmpDir, { recursive: true });

  const jsonPath = path.resolve(tmpDir, "phase05-tenant-backfill-proposal.json");
  const csvPath = path.resolve(tmpDir, "phase05-tenant-backfill-proposal.csv");
  await writeFile(jsonPath, JSON.stringify(output, null, 2), "utf8");
  await writeFile(csvPath, rowsToCsv(proposals), "utf8");

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        generatedAt: output.generatedAt,
        proposalOnly: output.proposalOnly,
        databaseWritesPerformed: output.databaseWritesPerformed,
        affectedUsers: output.affectedUsers,
        actionSummary: output.actionSummary,
        confidenceSummary: output.confidenceSummary,
        artifacts: {
          json: jsonPath,
          csv: csvPath,
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
