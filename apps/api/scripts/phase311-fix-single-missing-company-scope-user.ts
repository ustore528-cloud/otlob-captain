/**
 * Phase 3.1.1 — Fix a single active user missing `companyId` (data cleanup only).
 *
 * - Default: dry-run (read-only) + full investigation JSON.
 * - Apply: `ALLOW_PHASE311_MISSING_SCOPE_FIX=1` + `--apply` + env fingerprint (see output).
 * - No hard deletes; assign only with verified company from DB relations, never from guessing.
 *
 * Run from `apps/api`: `npx tsx scripts/phase311-fix-single-missing-company-scope-user.ts`
 */
import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { PrismaClient, UserRole } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "..");

const prisma = new PrismaClient();

const NEEDS_COMPANY = new Set<UserRole>([
  UserRole.COMPANY_ADMIN,
  UserRole.BRANCH_MANAGER,
  UserRole.DISPATCHER,
  UserRole.STORE_ADMIN,
  UserRole.STORE_USER,
  UserRole.CAPTAIN_SUPERVISOR,
]);

const NEEDS_BRANCH = new Set<UserRole>([UserRole.BRANCH_MANAGER, UserRole.CAPTAIN_SUPERVISOR]);

type Proposed = "assign_company" | "deactivate_user" | "manual_review";

type Investigation = {
  userId: string;
  user: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string;
    role: UserRole;
    isActive: boolean;
    companyId: string | null;
    branchId: string | null;
    publicOwnerCode: string | null;
    createdAt: string;
    updatedAt: string;
  };
  relations: {
    storesOwned: Array<{ id: string; name: string; companyId: string; branchId: string; isActive: boolean }>;
    storesAsSupervisor: Array<{ id: string; name: string; companyId: string; branchId: string; isActive: boolean }>;
    captain: { id: string; companyId: string; branchId: string; isActive: boolean } | null;
    createdCaptains: Array<{ id: string; companyId: string; branchId: string; isActive: boolean }>;
    orderCountsByCompany: Array<{ companyId: string; count: number }>;
    orderTotal: number;
    notifications: number;
    ledgerEntriesCreated: number;
  };
  lastActivity: { createdAt: string; action: string; entityType: string; entityId: string } | null;
  verified: {
    distinctCompanyIds: string[];
    distinctBranchIds: string[];
  };
  proposedAction: Proposed;
  proposedReason: string;
  assignIfApply?: { companyId: string; branchId: string | null };
};

function parseArgs(): { apply: boolean } {
  return { apply: process.argv.includes("--apply") };
}

function collectVerifiedCompanyBranchIds(
  rel: Investigation["relations"],
): { companyIds: Set<string>; branchIds: Set<string> } {
  const companyIds = new Set<string>();
  const branchIds = new Set<string>();
  for (const s of [...rel.storesOwned, ...rel.storesAsSupervisor]) {
    companyIds.add(s.companyId);
    branchIds.add(s.branchId);
  }
  if (rel.captain) {
    companyIds.add(rel.captain.companyId);
    branchIds.add(rel.captain.branchId);
  }
  for (const c of rel.createdCaptains) {
    companyIds.add(c.companyId);
    branchIds.add(c.branchId);
  }
  for (const r of rel.orderCountsByCompany) {
    companyIds.add(r.companyId);
  }
  return { companyIds, branchIds };
}

function decideProposed(role: UserRole, companyIds: Set<string>, branchIds: Set<string>): { action: Proposed; reason: string; assign?: { companyId: string; branchId: string | null } } {
  const cArr = [...companyIds];
  const bArr = [...branchIds];

  if (cArr.length > 1) {
    return {
      action: "manual_review",
      reason: "Multiple distinct companyIds from verified relations; cannot auto-assign a single company.",
    };
  }
  if (cArr.length === 0) {
    return {
      action: "deactivate_user",
      reason: "No verified company relation (stores, captain, created captains, or orders) to scope this user.",
    };
  }
  const companyId = cArr[0]!;

  if (NEEDS_BRANCH.has(role)) {
    if (bArr.length > 1) {
      return {
        action: "manual_review",
        reason: "Role requires branch scope; multiple distinct branchIds in verified relations.",
      };
    }
    if (bArr.length === 1) {
      return {
        action: "assign_company",
        reason: "Single company and single branch from verified relations.",
        assign: { companyId, branchId: bArr[0]! },
      };
    }
    return {
      action: "manual_review",
      reason: "Role requires branchId but no branch found on related entities.",
    };
  }

  // COMPANY_ADMIN / roles that need company but not branch
  return {
    action: "assign_company",
    reason: "Single company from verified relations; branch not required for this role (left null unless set below).",
    assign: { companyId, branchId: null },
  };
}

async function investigateUser(userId: string): Promise<Investigation> {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!u.isActive) {
    throw new Error(`User ${userId} is not active; Phase 3.1.1 targets active users only.`);
  }
  if (!NEEDS_COMPANY.has(u.role) || u.companyId) {
    throw new Error(`User ${userId} is not a missing-company case for this tool (role/company).`);
  }

  const [
    storesOwned,
    storesAsSupervisor,
    cap,
    createdCaptains,
    orderByCompany,
    orderTotal,
    notificationCount,
    ledgerCreated,
    lastAct,
  ] = await Promise.all([
    prisma.store.findMany({ where: { ownerUserId: u.id } }),
    prisma.store.findMany({ where: { supervisorUserId: u.id } }),
    prisma.captain.findUnique({ where: { userId: u.id } }),
    prisma.captain.findMany({ where: { createdByUserId: u.id } }),
    prisma.order.groupBy({
      by: ["companyId"],
      where: { OR: [{ createdByUserId: u.id }, { ownerUserId: u.id }] },
      _count: { _all: true },
    }),
    prisma.order.count({ where: { OR: [{ createdByUserId: u.id }, { ownerUserId: u.id }] } }),
    prisma.notification.count({ where: { userId: u.id } }),
    prisma.ledgerEntry.count({ where: { createdByUserId: u.id } }),
    prisma.activityLog.findFirst({ where: { userId: u.id }, orderBy: { createdAt: "desc" } }),
  ]);

  const relations: Investigation["relations"] = {
    storesOwned: storesOwned.map((s) => ({
      id: s.id,
      name: s.name,
      companyId: s.companyId,
      branchId: s.branchId,
      isActive: s.isActive,
    })),
    storesAsSupervisor: storesAsSupervisor.map((s) => ({
      id: s.id,
      name: s.name,
      companyId: s.companyId,
      branchId: s.branchId,
      isActive: s.isActive,
    })),
    captain: cap
      ? { id: cap.id, companyId: cap.companyId, branchId: cap.branchId, isActive: cap.isActive }
      : null,
    createdCaptains: createdCaptains.map((c) => ({
      id: c.id,
      companyId: c.companyId,
      branchId: c.branchId,
      isActive: c.isActive,
    })),
    orderCountsByCompany: orderByCompany.map((o) => ({ companyId: o.companyId, count: o._count._all })),
    orderTotal,
    notifications: notificationCount,
    ledgerEntriesCreated: ledgerCreated,
  };

  const { companyIds, branchIds } = collectVerifiedCompanyBranchIds(relations);
  const { action, reason, assign } = decideProposed(u.role, companyIds, branchIds);

  return {
    userId: u.id,
    user: {
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      phone: u.phone,
      role: u.role,
      isActive: u.isActive,
      companyId: u.companyId,
      branchId: u.branchId,
      publicOwnerCode: u.publicOwnerCode,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
    },
    relations,
    lastActivity: lastAct
      ? {
          createdAt: lastAct.createdAt.toISOString(),
          action: lastAct.action,
          entityType: lastAct.entityType,
          entityId: lastAct.entityId,
        }
      : null,
    verified: { distinctCompanyIds: [...companyIds], distinctBranchIds: [...branchIds] },
    proposedAction: action,
    proposedReason: reason,
    assignIfApply: assign,
  };
}

async function findSingleMissingCompanyUserId(): Promise<string> {
  const targetFromEnv = process.env.PHASE311_TARGET_USER_ID?.trim();
  if (targetFromEnv) {
    return targetFromEnv;
  }
  const active = await prisma.user.findMany({ where: { isActive: true } });
  const missing = active.filter((u) => NEEDS_COMPANY.has(u.role) && !u.companyId);
  if (missing.length === 0) {
    throw new Error("No active users are missing company scope. Nothing to fix.");
  }
  if (missing.length > 1) {
    const ids = missing.map((m) => m.id).join(", ");
    throw new Error(
      `Refusing: ${missing.length} active users missing company scope. Set PHASE311_TARGET_USER_ID to one id. Ids: ${ids}`,
    );
  }
  return missing[0]!.id;
}

async function main() {
  const { apply } = parseArgs();
  const userId = await findSingleMissingCompanyUserId();
  const before = await investigateUser(userId);

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        mode: apply ? "preApplyInvestigation" : "dryRun",
        ...before,
        applyCommandsHint: apply ? undefined : { note: "See printed env for --apply" },
      },
      null,
      2,
    ),
  );

  if (!apply) {
    // eslint-disable-next-line no-console
    console.log(
      "\n--- Apply would require (if you choose to) ---\n" +
        `PHASE311_TARGET_USER_ID=${before.userId}\n` +
        `PHASE311_EXPECTED_UPDATED_AT=${before.user.updatedAt}\n` +
        `ALLOW_PHASE311_MISSING_SCOPE_FIX=1\n` +
        "npx tsx scripts/phase311-fix-single-missing-company-scope-user.ts --apply\n",
    );
    return;
  }

  if (process.env.ALLOW_PHASE311_MISSING_SCOPE_FIX !== "1") {
    throw new Error("Refusing --apply: set ALLOW_PHASE311_MISSING_SCOPE_FIX=1");
  }
  if (process.env.PHASE311_TARGET_USER_ID?.trim() !== before.userId) {
    throw new Error(
      "Refusing --apply: PHASE311_TARGET_USER_ID must match dry-run user id. Re-run without --apply first.",
    );
  }
  const expectAt = process.env.PHASE311_EXPECTED_UPDATED_AT?.trim();
  if (expectAt !== before.user.updatedAt) {
    throw new Error(
      `Refusing --apply: PHASE311_EXPECTED_UPDATED_AT mismatch (concurrent change?) want ${JSON.stringify(expectAt)} got ${JSON.stringify(before.user.updatedAt)}`,
    );
  }

  if (before.proposedAction === "manual_review") {
    throw new Error("Refusing --apply: proposedAction is manual_review. Resolve data manually, then re-run dry-run.");
  }

  if (before.proposedAction === "deactivate_user") {
    const up = await prisma.user.update({
      where: { id: before.userId },
      data: { isActive: false },
    });
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          mode: "apply",
          action: "deactivate_user",
          after: { id: up.id, isActive: up.isActive, updatedAt: up.updatedAt.toISOString() },
        },
        null,
        2,
      ),
    );
  } else {
    // assign_company
    const a = before.assignIfApply;
    if (!a) {
      throw new Error("Internal: assign_company without assignIfApply");
    }
    const up = await prisma.user.update({
      where: { id: before.userId },
      data: { companyId: a.companyId, branchId: a.branchId },
    });
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          mode: "apply",
          action: "assign_company",
          after: {
            id: up.id,
            companyId: up.companyId,
            branchId: up.branchId,
            updatedAt: up.updatedAt.toISOString(),
          },
        },
        null,
        2,
      ),
    );
  }

  const v = spawnSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", "verify:phase0:tenant-negative", "-w", "@captain/api"],
    { cwd: path.resolve(apiRoot, "..", ".."), encoding: "utf8" },
  );
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      { verifyPhase0AfterApply: { exitCode: v.status, stdout: v.stdout?.slice(0, 4000) } },
      null,
      2,
    ),
  );
  if (v.status !== 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
