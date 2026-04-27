/**
 * Shared Phase 3.4+ user cleanup preview — read-only. Used by:
 *   phase340-preview-user-cleanup.ts, phase341-apply-user-cleanup.ts
 */
import { UserRole } from "@prisma/client";
import { prisma } from "../../src/lib/prisma.js";

export type ProposedAction = "keep_super_admin" | "deactivate_user" | "manual_review" | "remain_inactive";

export type LinkedCaptain = {
  captainId: string;
  userId: string;
  isActive: boolean;
  companyId: string;
  branchId: string;
};

export type OwnedStore = {
  id: string;
  name: string;
  isActive: boolean;
};

export type UserPreviewRow = {
  userId: string;
  email: string | null;
  phone: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  companyId: string | null;
  branchId: string | null;
  linkedCaptain: LinkedCaptain | null;
  ownedStores: OwnedStore[];
  createdOrdersCount: number;
  ledgerEntriesCreatedCount: number;
  activityLogsCount: number;
  proposedAction: ProposedAction;
  riskNote: string;
};

type Summary = {
  totalUsers: number;
  activeUsers: number;
  usersToKeep: number;
  usersProposedDeactivation: number;
  manualReviewCount: number;
  remainInactiveCount: number;
};

export type UserCleanupPlan = {
  generatedAt: string;
  phase: string;
  dryRun: true;
  noDatabaseWrites: true;
  keepSuperAdminEmailEnv: string | null;
  keepSuperAdminEmailUsed: string | null;
  blockers: string[];
  previewValid: boolean;
  keepUserId: string | null;
  summary: Summary;
  users: UserPreviewRow[];
  notes: string[];
};

function buildRiskForDeactivate(
  u: { role: UserRole; isActive: boolean },
  ownStores: number,
  hasCaptain: boolean,
  createdOrders: number,
  ledgers: number,
  activity: number,
): string {
  const parts: string[] = [
    "Preview only: no DB writes. Future apply would set isActive=false; does not delete orders, companies, ledgers, or activity rows.",
  ];
  if (u.role === UserRole.SUPER_ADMIN) {
    parts.push(
      "This user is a second active SUPER_ADMIN; deactivation is still proposed for post-review apply — confirm org policy and access transfer first.",
    );
  }
  if (ownStores > 0) parts.push(`Owns ${ownStores} store(s). Review ownership/operations before deactivation.`);
  if (hasCaptain) parts.push("Has a linked captain profile; review operational impact.");
  if (createdOrders > 0) parts.push(`Created ${createdOrders} order(s) (audit trail; rows are not removed).`);
  if (ledgers > 0) parts.push(`Created ${ledgers} ledger line(s) as operator (append-only).`);
  if (activity > 0) parts.push(`Has ${activity} activity log(s).`);
  return parts.join(" ");
}

export type UserCleanupPlanOptions = {
  keepEmailRaw: string | null | undefined;
  phase: string;
  /** Used in error messages, e.g. "PHASE341_KEEP_SUPER_ADMIN_EMAIL" */
  envVarName: string;
};

/**
 * When `keepEmailRaw` is null/empty, the plan is invalid for apply (see `blockers` / `previewValid`).
 * `keepUserId` is set only when the keep user is validated (unique active SUPER_ADMIN target).
 */
export async function buildUserCleanupPlan(options: UserCleanupPlanOptions): Promise<UserCleanupPlan> {
  const emailNorm = (options.keepEmailRaw ?? "").trim() || null;
  const envN = options.envVarName;
  const blockers: string[] = [];
  if (!emailNorm) {
    blockers.push(`${envN} is missing or empty.`);
  }

  const keepUser =
    emailNorm === null
      ? null
      : await prisma.user.findFirst({
          where: { email: { equals: emailNorm, mode: "insensitive" } },
          select: { id: true, email: true, role: true, isActive: true, phone: true, fullName: true },
        });

  if (emailNorm && !keepUser) {
    blockers.push(`No user found with email matching (case-insensitive): ${emailNorm}`);
  } else if (keepUser) {
    if (keepUser.role !== UserRole.SUPER_ADMIN) {
      blockers.push(`User ${keepUser.id} is not SUPER_ADMIN (role=${keepUser.role}).`);
    }
    if (!keepUser.isActive) {
      blockers.push(`User ${keepUser.id} is not active (isActive=false).`);
    }
  }

  const previewValid = blockers.length === 0;
  const keepId = keepUser && previewValid ? keepUser.id : null;

  const all = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      phone: true,
      fullName: true,
      role: true,
      isActive: true,
      companyId: true,
      branchId: true,
      captain: {
        select: { id: true, userId: true, isActive: true, companyId: true, branchId: true },
      },
      ownedStores: { select: { id: true, name: true, isActive: true } },
    },
  });

  const userIds = all.map((u) => u.id);

  const [orderGroups, ledgerGroups, activityGroups] = await Promise.all([
    userIds.length
      ? prisma.order.groupBy({
          by: ["createdByUserId"],
          where: { createdByUserId: { in: userIds } },
          _count: { _all: true },
        })
      : Promise.resolve([] as { createdByUserId: string; _count: { _all: number } }[]),
    userIds.length
      ? prisma.ledgerEntry.groupBy({
          by: ["createdByUserId"],
          where: { createdByUserId: { in: userIds } },
          _count: { _all: true },
        })
      : Promise.resolve([] as { createdByUserId: string; _count: { _all: number } }[]),
    userIds.length
      ? prisma.activityLog.groupBy({
          by: ["userId"],
          where: { userId: { in: userIds } },
          _count: { _all: true },
        })
      : Promise.resolve([] as { userId: string; _count: { _all: number } }[]),
  ]);

  const orderMap = new Map(
    orderGroups
      .filter((g) => g.createdByUserId != null)
      .map((g) => [g.createdByUserId as string, g._count._all]),
  );
  const ledgerMap = new Map(
    ledgerGroups
      .filter((g) => g.createdByUserId != null)
      .map((g) => [g.createdByUserId as string, g._count._all]),
  );
  const activityMap = new Map(
    activityGroups.filter((g) => g.userId != null).map((g) => [g.userId as string, g._count._all]),
  );

  const users: UserPreviewRow[] = all.map((u) => {
    const createdOrdersCount = orderMap.get(u.id) ?? 0;
    const ledgerEntriesCreatedCount = ledgerMap.get(u.id) ?? 0;
    const activityLogsCount = activityMap.get(u.id) ?? 0;
    const linkedCaptain: LinkedCaptain | null = u.captain
      ? {
          captainId: u.captain.id,
          userId: u.captain.userId,
          isActive: u.captain.isActive,
          companyId: u.captain.companyId,
          branchId: u.captain.branchId,
        }
      : null;
    const ownedStores: OwnedStore[] = u.ownedStores.map((s) => ({
      id: s.id,
      name: s.name,
      isActive: s.isActive,
    }));

    let proposedAction: ProposedAction;
    let riskNote: string;

    if (!previewValid) {
      proposedAction = u.isActive ? "manual_review" : "remain_inactive";
      riskNote = u.isActive
        ? `Preview blocked: ${blockers.join(" ")}`
        : "Already inactive; deactivation not applicable. Fix blockers before relying on an apply phase.";
    } else if (keepId && u.id === keepId) {
      proposedAction = "keep_super_admin";
      riskNote = "Retained as the only approved active Super Admin (user cleanup plan).";
    } else if (!u.isActive) {
      proposedAction = "remain_inactive";
      riskNote = "Already inactive; no change proposed in this plan.";
    } else {
      proposedAction = "deactivate_user";
      riskNote = buildRiskForDeactivate(
        { role: u.role, isActive: u.isActive },
        ownedStores.length,
        Boolean(linkedCaptain),
        createdOrdersCount,
        ledgerEntriesCreatedCount,
        activityLogsCount,
      );
    }

    return {
      userId: u.id,
      email: u.email,
      phone: u.phone,
      fullName: u.fullName,
      role: u.role,
      isActive: u.isActive,
      companyId: u.companyId,
      branchId: u.branchId,
      linkedCaptain,
      ownedStores,
      createdOrdersCount,
      ledgerEntriesCreatedCount,
      activityLogsCount,
      proposedAction,
      riskNote,
    };
  });

  const activeUsers = users.filter((u) => u.isActive).length;
  const usersToKeep = keepId ? users.filter((u) => u.proposedAction === "keep_super_admin").length : 0;
  const usersProposedDeactivation = users.filter((u) => u.proposedAction === "deactivate_user").length;
  const manualReviewCount = users.filter((u) => u.proposedAction === "manual_review").length;
  const remainInactiveCount = users.filter((u) => u.proposedAction === "remain_inactive").length;

  const summary: Summary = {
    totalUsers: users.length,
    activeUsers,
    usersToKeep,
    usersProposedDeactivation,
    manualReviewCount,
    remainInactiveCount,
  };

  return {
    generatedAt: new Date().toISOString(),
    phase: options.phase,
    dryRun: true,
    noDatabaseWrites: true,
    keepSuperAdminEmailEnv: emailNorm,
    keepSuperAdminEmailUsed: keepUser?.email?.trim() ?? null,
    blockers,
    previewValid,
    keepUserId: keepId,
    summary,
    users,
    notes: [
      "Read-only plan: this function only queries the database. Apply scripts may update isActive on users only; no deletes.",
      "No orders, captains, companies, wallets, ledgers, or activity logs are removed by a cleanup apply.",
    ],
  };
}
