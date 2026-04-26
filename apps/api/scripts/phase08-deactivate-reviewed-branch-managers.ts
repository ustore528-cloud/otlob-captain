/**
 * Phase 0.8: guarded deactivation prep for reviewed BRANCH_MANAGER users.
 *
 * Safety:
 * - Default mode is dry-run.
 * - --apply requires ALLOW_PHASE08_BRANCH_MANAGER_DEACTIVATION=1.
 * - Touches only explicit allowlist rows (id + email pair).
 * - Refuses if role/scope/relations drift from reviewed baseline.
 * - Never deletes users; only sets isActive=false in apply mode.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { PrismaClient, UserRole } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "..", ".env"), override: true });

const prisma = new PrismaClient();

type Mode = "dry-run" | "apply";

type ApprovedTarget = {
  userId: string;
  email: string;
};

type Candidate = {
  userId: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  currentCompanyId: string | null;
  currentBranchId: string | null;
  ownedStoresCount: number;
  createdStoresCount: number;
  createdCaptainsCount: number;
  createdOrdersCount: number;
  assignedBranchRelation: { branchId: string; branchCompanyId: string } | null;
  proposedUpdate: { isActive: false };
  riskNote: string;
  eligible: boolean;
  ineligibleReason: string | null;
};

const APPROVED_ALLOWLIST: ApprovedTarget[] = [
  { userId: "cmocpq2h10008ume0wwn6n9ev", email: "ad2min1@admin.com" },
  { userId: "cmocxpp8y006kumhoijqtpre1", email: "ustore5228@gmail.com" },
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
  for (const target of APPROVED_ALLOWLIST) {
    const user = await prisma.user.findUnique({
      where: { id: target.userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        companyId: true,
        branchId: true,
        branch: { select: { id: true, companyId: true } },
        ownedStores: { where: { isActive: true }, select: { id: true } },
        createdCaptains: { select: { id: true } },
        ordersCreated: { select: { id: true } },
        activityLogs: {
          where: { entityType: { in: ["STORE", "store"] }, action: { contains: "CREATE" } },
          select: { id: true },
        },
      },
    });

    if (!user) {
      rows.push({
        userId: target.userId,
        email: target.email,
        role: UserRole.BRANCH_MANAGER,
        isActive: false,
        currentCompanyId: null,
        currentBranchId: null,
        ownedStoresCount: 0,
        createdStoresCount: 0,
        createdCaptainsCount: 0,
        createdOrdersCount: 0,
        assignedBranchRelation: null,
        proposedUpdate: { isActive: false },
        riskNote: "Allowlisted user not found; no action possible.",
        eligible: false,
        ineligibleReason: "user_not_found",
      });
      continue;
    }

    let ineligibleReason: string | null = null;
    if ((user.email ?? "").toLowerCase() !== target.email.toLowerCase()) {
      ineligibleReason = "allowlist_email_mismatch";
    }
    if (user.role !== UserRole.BRANCH_MANAGER) ineligibleReason = "role_changed_or_not_branch_manager";
    if (user.companyId !== null || user.branchId !== null) ineligibleReason = "tenant_scope_no_longer_null";
    if (user.ownedStores.length > 0) ineligibleReason = "has_owned_stores";
    if (user.activityLogs.length > 0) ineligibleReason = "has_created_store_activity";
    if (user.createdCaptains.length > 0) ineligibleReason = "has_created_captains";
    if (user.ordersCreated.length > 0) ineligibleReason = "has_created_orders";
    if (user.branch) ineligibleReason = "has_assigned_branch_relation";
    if (!user.isActive) ineligibleReason = "already_inactive";

    rows.push({
      userId: user.id,
      email: user.email ?? target.email,
      role: user.role,
      isActive: user.isActive,
      currentCompanyId: user.companyId,
      currentBranchId: user.branchId,
      ownedStoresCount: user.ownedStores.length,
      createdStoresCount: user.activityLogs.length,
      createdCaptainsCount: user.createdCaptains.length,
      createdOrdersCount: user.ordersCreated.length,
      assignedBranchRelation: user.branch
        ? { branchId: user.branch.id, branchCompanyId: user.branch.companyId }
        : null,
      proposedUpdate: { isActive: false },
      riskNote:
        "Deactivation impacts account access. Keep audit trail and allow rollback by reactivating isActive if needed.",
      eligible: ineligibleReason == null,
      ineligibleReason,
    });
  }
  return rows;
}

async function runApply(candidates: Candidate[]) {
  const toDeactivate = candidates.filter((c) => c.eligible);
  const beforeAfter: Array<{
    userId: string;
    email: string;
    role: UserRole;
    beforeIsActive: boolean;
    afterIsActive: boolean;
    companyId: string | null;
    branchId: string | null;
  }> = [];

  await prisma.$transaction(async (tx) => {
    for (const row of toDeactivate) {
      const fresh = await tx.user.findUnique({
        where: { id: row.userId },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          companyId: true,
          branchId: true,
          branch: { select: { id: true } },
          ownedStores: { where: { isActive: true }, select: { id: true } },
          createdCaptains: { select: { id: true } },
          ordersCreated: { select: { id: true } },
          activityLogs: {
            where: { entityType: { in: ["STORE", "store"] }, action: { contains: "CREATE" } },
            select: { id: true },
          },
        },
      });

      if (!fresh) throw new Error(`User disappeared during apply: ${row.userId}`);
      if (fresh.role !== UserRole.BRANCH_MANAGER) {
        throw new Error(`Role drift detected for ${fresh.email ?? fresh.id}`);
      }
      if (fresh.companyId !== null || fresh.branchId !== null) {
        throw new Error(`Scope drift detected for ${fresh.email ?? fresh.id}`);
      }
      if (
        fresh.ownedStores.length > 0 ||
        fresh.activityLogs.length > 0 ||
        fresh.createdCaptains.length > 0 ||
        fresh.ordersCreated.length > 0 ||
        fresh.branch
      ) {
        throw new Error(`Relation/activity drift detected for ${fresh.email ?? fresh.id}`);
      }
      if (!fresh.isActive) {
        throw new Error(`User already inactive: ${fresh.email ?? fresh.id}`);
      }

      await tx.user.update({
        where: { id: row.userId },
        data: { isActive: false },
      });

      beforeAfter.push({
        userId: fresh.id,
        email: fresh.email ?? row.email,
        role: fresh.role,
        beforeIsActive: fresh.isActive,
        afterIsActive: false,
        companyId: fresh.companyId,
        branchId: fresh.branchId,
      });
    }
  });

  const verification = await prisma.user.findMany({
    where: { id: { in: toDeactivate.map((r) => r.userId) } },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      companyId: true,
      branchId: true,
    },
    orderBy: { email: "asc" },
  });

  const remainingBranchManagersMissingScope = await prisma.user.count({
    where: {
      role: UserRole.BRANCH_MANAGER,
      isActive: true,
      OR: [{ companyId: null }, { branchId: null }],
    },
  });

  return {
    attempted: toDeactivate.length,
    beforeAfter,
    verification,
    postApplyChecks: {
      activeBranchManagersMissingCompanyOrBranch: remainingBranchManagersMissingScope,
      targetExpectation: 0,
    },
  };
}

async function main() {
  const mode = parseMode(process.argv.slice(2));
  if (mode === "apply" && process.env.ALLOW_PHASE08_BRANCH_MANAGER_DEACTIVATION !== "1") {
    throw new Error("Refusing --apply without ALLOW_PHASE08_BRANCH_MANAGER_DEACTIVATION=1");
  }

  const candidates = await buildCandidates();
  const eligible = candidates.filter((c) => c.eligible);
  const ineligible = candidates.filter((c) => !c.eligible);
  const allowlistIds = new Set(APPROVED_ALLOWLIST.map((x) => x.userId));
  const touchedOutsideAllowlist = candidates.some((c) => !allowlistIds.has(c.userId));

  const payload: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    mode,
    proposalOnly: mode === "dry-run",
    databaseWritesPerformed: false,
    safety: {
      applyRequested: mode === "apply",
      allowEnvPresent: process.env.ALLOW_PHASE08_BRANCH_MANAGER_DEACTIVATION === "1",
      allowlistSize: APPROVED_ALLOWLIST.length,
      touchedOutsideAllowlist,
    },
    candidates: candidates.map((c) => ({
      userId: c.userId,
      email: c.email,
      role: c.role,
      isActive: c.isActive,
      currentCompanyId: c.currentCompanyId,
      currentBranchId: c.currentBranchId,
      ownedStoresCount: c.ownedStoresCount,
      createdStoresCount: c.createdStoresCount,
      createdCaptainsCount: c.createdCaptainsCount,
      createdOrdersCount: c.createdOrdersCount,
      assignedBranchRelation: c.assignedBranchRelation,
      proposedUpdate: c.proposedUpdate,
      riskNote: c.riskNote,
      eligible: c.eligible,
      ineligibleReason: c.ineligibleReason,
    })),
    summary: {
      eligibleRows: eligible.length,
      wouldDeactivateRows: eligible.length,
      ineligibleRows: ineligible.length,
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
