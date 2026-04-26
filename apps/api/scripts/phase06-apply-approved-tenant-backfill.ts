/**
 * Phase 0.6: dry-run/apply script for approved STORE_ADMIN tenant backfill.
 *
 * Safety:
 * - Default mode is dry-run.
 * - --apply requires ALLOW_PHASE06_TENANT_BACKFILL=1.
 * - Only approved allowlist users are eligible.
 * - Refuses BRANCH_MANAGER users and all non-STORE_ADMIN roles.
 * - Refuses if role changed or owned-store tenant relation no longer matches proposal.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { PrismaClient, UserRole } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "..", ".env"), override: true });

const prisma = new PrismaClient();

type Mode = "dry-run" | "apply";

type ApprovedRow = {
  email: string;
  proposedCompanyId: string;
  proposedBranchId: string;
};

const APPROVED_ALLOWLIST: ApprovedRow[] = [
  {
    email: "store@example.com",
    proposedCompanyId: "cd8xptlzhophhzlxl036ehf6g",
    proposedBranchId: "cpkeiii7o4nfcxx7d0ymncwcs",
  },
  {
    email: "smoke-store-a2@example.com",
    proposedCompanyId: "cd8xptlzhophhzlxl036ehf6g",
    proposedBranchId: "cmob0vznz0001umiwd5v1bpx0",
  },
  {
    email: "smoke-store-b1@example.com",
    proposedCompanyId: "cmob0w0bz0002umiweako63e2",
    proposedBranchId: "cmob0w0u10004umiwtv41ooye",
  },
  {
    email: "smoke-store-a1@example.com",
    proposedCompanyId: "cd8xptlzhophhzlxl036ehf6g",
    proposedBranchId: "cpkeiii7o4nfcxx7d0ymncwcs",
  },
];

const EXPLICITLY_UNTOUCHED_BRANCH_MANAGERS = ["ad2min1@admin.com", "ustore5228@gmail.com"];

type Candidate = {
  userId: string;
  email: string | null;
  phone: string;
  role: UserRole;
  currentCompanyId: string | null;
  currentBranchId: string | null;
  ownedStoreIds: string[];
  ownedStoreCompanyIds: string[];
  ownedStoreBranchIds: string[];
  proposedCompanyId: string;
  proposedBranchId: string;
  inferenceSource: string;
  proposedDbUpdate: Record<string, string>;
  riskNote: string;
  eligible: boolean;
  ineligibleReason: string | null;
};

function parseMode(argv: string[]): Mode {
  const hasApply = argv.includes("--apply");
  const hasDryRun = argv.includes("--dry-run");
  if (hasApply && hasDryRun) {
    throw new Error("Use only one mode: --dry-run or --apply");
  }
  if (hasApply) return "apply";
  return "dry-run";
}

function uniq(values: string[]): string[] {
  return [...new Set(values)];
}

async function buildCandidates(): Promise<Candidate[]> {
  const rows: Candidate[] = [];
  for (const approved of APPROVED_ALLOWLIST) {
    const user = await prisma.user.findFirst({
      where: { email: approved.email },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        companyId: true,
        branchId: true,
        ownedStores: { where: { isActive: true }, select: { id: true, companyId: true, branchId: true } },
      },
    });

    if (!user) {
      rows.push({
        userId: "(missing)",
        email: approved.email,
        phone: "",
        role: UserRole.STORE_ADMIN,
        currentCompanyId: null,
        currentBranchId: null,
        ownedStoreIds: [],
        ownedStoreCompanyIds: [],
        ownedStoreBranchIds: [],
        proposedCompanyId: approved.proposedCompanyId,
        proposedBranchId: approved.proposedBranchId,
        inferenceSource: "approved_allowlist_active_owned_store_relation",
        proposedDbUpdate: { companyId: approved.proposedCompanyId },
        riskNote: "Approved allowlist email not found. No update possible.",
        eligible: false,
        ineligibleReason: "user_not_found",
      });
      continue;
    }

    const storeCompanyIds = uniq(user.ownedStores.map((s) => s.companyId));
    const storeBranchIds = uniq(user.ownedStores.map((s) => s.branchId));
    const storeIds = user.ownedStores.map((s) => s.id);

    let ineligibleReason: string | null = null;
    if (user.role !== UserRole.STORE_ADMIN) ineligibleReason = "role_changed_or_not_store_admin";
    if (user.role === UserRole.BRANCH_MANAGER) ineligibleReason = "branch_manager_explicitly_untouched";
    if (EXPLICITLY_UNTOUCHED_BRANCH_MANAGERS.includes(user.email ?? "")) {
      ineligibleReason = "branch_manager_explicitly_untouched";
    }
    if (storeIds.length !== 1) ineligibleReason = "owned_store_relation_not_single";
    if (storeCompanyIds.length !== 1 || storeCompanyIds[0] !== approved.proposedCompanyId) {
      ineligibleReason = "owned_store_company_mismatch";
    }
    if (storeBranchIds.length !== 1 || storeBranchIds[0] !== approved.proposedBranchId) {
      ineligibleReason = "owned_store_branch_mismatch";
    }

    rows.push({
      userId: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      currentCompanyId: user.companyId,
      currentBranchId: user.branchId,
      ownedStoreIds: storeIds,
      ownedStoreCompanyIds: storeCompanyIds,
      ownedStoreBranchIds: storeBranchIds,
      proposedCompanyId: approved.proposedCompanyId,
      proposedBranchId: approved.proposedBranchId,
      inferenceSource: "approved_allowlist_active_owned_store_relation",
      proposedDbUpdate: { companyId: approved.proposedCompanyId },
      riskNote:
        "STORE_ADMIN currently needs company scope for staff tenant filtering; branch scope is derived via owned store relation in current model.",
      eligible: ineligibleReason == null,
      ineligibleReason,
    });
  }
  return rows;
}

async function runApply(candidates: Candidate[]) {
  const toUpdate = candidates.filter((c) => c.eligible && c.currentCompanyId !== c.proposedCompanyId);
  const updatedUserIds: string[] = [];

  await prisma.$transaction(async (tx) => {
    for (const row of toUpdate) {
      const fresh = await tx.user.findUnique({
        where: { id: row.userId },
        select: {
          id: true,
          email: true,
          role: true,
          companyId: true,
          ownedStores: { where: { isActive: true }, select: { companyId: true, branchId: true } },
        },
      });
      if (!fresh) throw new Error(`User disappeared during apply: ${row.userId}`);
      if (fresh.role !== UserRole.STORE_ADMIN) {
        throw new Error(`Role drift detected for ${fresh.email ?? fresh.id}`);
      }
      const freshCompanyIds = uniq(fresh.ownedStores.map((s) => s.companyId));
      const freshBranchIds = uniq(fresh.ownedStores.map((s) => s.branchId));
      if (
        fresh.ownedStores.length !== 1 ||
        freshCompanyIds.length !== 1 ||
        freshBranchIds.length !== 1 ||
        freshCompanyIds[0] !== row.proposedCompanyId ||
        freshBranchIds[0] !== row.proposedBranchId
      ) {
        throw new Error(`Owned store relation drift for ${fresh.email ?? fresh.id}; aborting apply`);
      }
      await tx.user.update({
        where: { id: row.userId },
        data: { companyId: row.proposedCompanyId },
      });
      updatedUserIds.push(row.userId);
    }
  });

  const verification = await prisma.user.findMany({
    where: { id: { in: updatedUserIds } },
    select: { id: true, email: true, role: true, companyId: true, branchId: true },
    orderBy: { email: "asc" },
  });

  return { attempted: toUpdate.length, updatedUserIds, verification };
}

async function main() {
  const mode = parseMode(process.argv.slice(2));
  const applyRequested = mode === "apply";
  if (applyRequested && process.env.ALLOW_PHASE06_TENANT_BACKFILL !== "1") {
    throw new Error("Refusing --apply without ALLOW_PHASE06_TENANT_BACKFILL=1");
  }

  const candidates = await buildCandidates();
  const toUpdate = candidates.filter((c) => c.eligible && c.currentCompanyId !== c.proposedCompanyId);
  const untouchedBranchManagers = await prisma.user.findMany({
    where: { email: { in: EXPLICITLY_UNTOUCHED_BRANCH_MANAGERS } },
    select: { id: true, email: true, role: true, companyId: true, branchId: true },
    orderBy: { email: "asc" },
  });

  const beforeAfterPreview = candidates.map((c) => ({
    userId: c.userId,
    email: c.email,
    role: c.role,
    currentCompanyId: c.currentCompanyId,
    currentBranchId: c.currentBranchId,
    proposedCompanyId: c.proposedCompanyId,
    proposedBranchId: c.proposedBranchId,
    ownedStoreRelation: {
      storeIds: c.ownedStoreIds,
      companyIds: c.ownedStoreCompanyIds,
      branchIds: c.ownedStoreBranchIds,
      inferenceSource: c.inferenceSource,
    },
    proposedDbUpdate: c.proposedDbUpdate,
    riskNote: c.riskNote,
    eligible: c.eligible,
    ineligibleReason: c.ineligibleReason,
  }));

  const payload: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    mode,
    proposalOnly: mode === "dry-run",
    safety: {
      applyRequested,
      allowEnvPresent: process.env.ALLOW_PHASE06_TENANT_BACKFILL === "1",
      branchManagersExplicitlyUntouched: EXPLICITLY_UNTOUCHED_BRANCH_MANAGERS,
    },
    allowlistSize: APPROVED_ALLOWLIST.length,
    candidates: beforeAfterPreview,
    summary: {
      eligibleRows: candidates.filter((c) => c.eligible).length,
      wouldUpdateRows: toUpdate.length,
      ineligibleRows: candidates.filter((c) => !c.eligible).length,
    },
    untouchedBranchManagerRows: untouchedBranchManagers,
  };

  if (mode === "apply") {
    const applyResult = await runApply(candidates);
    payload.applyResult = applyResult;
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
