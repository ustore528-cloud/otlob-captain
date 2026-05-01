import type { UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/errors.js";
import { isOrderOperatorRole, isSuperAdminRole, type AppRole } from "../lib/rbac-roles.js";

export type StaffTenantOrderListFilter = { companyId?: string; branchId?: string };

/**
 * Resolves company (and optional branch) filters for ADMIN/DISPATCHER order/store/captain lists.
 * JWT may omit companyId on older tokens — falls back to the user row, then single-company mode.
 */
export async function resolveStaffTenantOrderListFilter(actor: {
  userId: string;
  role: AppRole;
  companyId: string | null;
  branchId: string | null;
}): Promise<StaffTenantOrderListFilter> {
  if (!isOrderOperatorRole(actor.role)) {
    throw new AppError(500, "Tenant list filter is only valid for staff roles", "INTERNAL");
  }

  let companyId = actor.companyId;
  let branchId = actor.branchId;

  const row = await prisma.user.findUnique({
    where: { id: actor.userId },
    select: { companyId: true, branchId: true },
  });
  companyId = companyId ?? row?.companyId ?? null;
  branchId = branchId ?? row?.branchId ?? null;

  if (isSuperAdminRole(actor.role)) {
    return {};
  }

  if (!companyId) {
    const n = await prisma.company.count();
    if (n === 1) {
      const only = await prisma.company.findFirst({ select: { id: true } });
      companyId = only?.id ?? null;
    }
  }

  if (!companyId) {
    throw new AppError(
      403,
      "Company scope is required on your account for this operation.",
      "TENANT_SCOPE_REQUIRED",
    );
  }

  // Captain supervisor must always stay scoped (company + branch).
  if (actor.role === "CAPTAIN_SUPERVISOR") {
    if (!branchId) {
      throw new AppError(
        403,
        "Branch scope is required on CAPTAIN_SUPERVISOR accounts.",
        "TENANT_BRANCH_REQUIRED",
      );
    }
  }

  if (branchId) {
    const okBranch = await prisma.branch.findFirst({
      where: { id: branchId, companyId, isActive: true },
      select: { id: true },
    });
    if (!okBranch) {
      throw new AppError(403, "Branch scope is invalid for your company.", "TENANT_BRANCH_INVALID");
    }
    return { companyId, branchId };
  }

  return { companyId };
}

/** Resolves branch (+ company) when creating captains/stores: optional explicit branch, else staff default / single-branch fallback. */
export async function resolveBranchIdForStaffOperation(
  staffUserId: string,
  explicitBranchId: string | undefined,
): Promise<{ companyId: string; branchId: string }> {
  const user = await prisma.user.findUnique({
    where: { id: staffUserId },
    select: { companyId: true, branchId: true, role: true },
  });
  if (!user) throw new AppError(401, "User not found", "UNAUTHORIZED");

  let effectiveCompanyId = user.companyId;
  const superAdmin = user.role === "SUPER_ADMIN";
  if (!effectiveCompanyId) {
    const n = await prisma.company.count();
    if (n === 1) {
      const only = await prisma.company.findFirst({ select: { id: true } });
      effectiveCompanyId = only?.id ?? null;
    }
  }
  if (!effectiveCompanyId && !superAdmin) {
    throw new AppError(
      403,
      "Company scope is required on your account (multi-tenant).",
      "TENANT_SCOPE_REQUIRED",
    );
  }

  if (explicitBranchId) {
    const b = await prisma.branch.findFirst({
      where: {
        id: explicitBranchId,
        ...(effectiveCompanyId ? { companyId: effectiveCompanyId } : {}),
        isActive: true,
      },
      select: { id: true, companyId: true },
    });
    if (!b) throw new AppError(400, "Invalid branch for your company.", "INVALID_BRANCH");
    return { companyId: b.companyId, branchId: b.id };
  }

  if (user.branchId) {
    const b = await prisma.branch.findFirst({
      where: {
        id: user.branchId,
        ...(effectiveCompanyId ? { companyId: effectiveCompanyId } : {}),
        isActive: true,
      },
      select: { id: true, companyId: true },
    });
    if (b) return { companyId: b.companyId, branchId: b.id };
  }

  const branches = await prisma.branch.findMany({
    where: {
      ...(effectiveCompanyId ? { companyId: effectiveCompanyId } : {}),
      isActive: true,
    },
    select: { id: true, companyId: true },
    orderBy: { createdAt: "asc" },
  });
  if (branches.length === 1) {
    const onlyBranch = branches[0];
    if (!onlyBranch) {
      throw new AppError(500, "Branch resolution failed", "INTERNAL");
    }
    return { companyId: onlyBranch.companyId, branchId: onlyBranch.id };
  }

  throw new AppError(
    400,
    "branchId is required when your company has more than one active branch.",
    "BRANCH_REQUIRED",
  );
}

export function assertOrderAndCaptainSameBranch(order: { branchId: string }, captain: { branchId: string }): void {
  if (order.branchId !== captain.branchId) {
    throw new AppError(403, "Captain is not allowed to serve this branch.", "TENANT_BRANCH_MISMATCH");
  }
}

export function assertOrderAndCaptainSameCompany(
  order: { companyId: string; branchId: string },
  captain: { companyId: string; branchId: string },
): void {
  if (order.companyId !== captain.companyId) {
    throw new AppError(403, "Captain belongs to a different company.", "TENANT_COMPANY_MISMATCH");
  }
  if (order.branchId !== captain.branchId) {
    throw new AppError(403, "Captain is not allowed to serve this branch.", "TENANT_BRANCH_MISMATCH");
  }
}

export async function assertStaffCanAccessOrder(
  actor: { userId: string; role: AppRole; companyId: string | null; branchId: string | null },
  order: {
    companyId: string;
    branchId: string;
    ownerUserId?: string | null;
    createdByUserId?: string | null;
    assignedCaptain?: { createdByUserId?: string | null } | null;
  },
): Promise<void> {
  if (!isOrderOperatorRole(actor.role)) return;
  if (isSuperAdminRole(actor.role)) return;
  const scope = await resolveStaffTenantOrderListFilter(actor);
  if (scope.companyId && order.companyId !== scope.companyId) {
    throw new AppError(403, "Forbidden", "FORBIDDEN");
  }
  if (scope.branchId && order.branchId !== scope.branchId) {
    throw new AppError(403, "Forbidden", "FORBIDDEN");
  }
  /** COMPANY_ADMIN: company (and optional branch) match is sufficient — Phase 3.2.2. */
}

export async function assertStaffCanAccessCaptain(
  actor: { userId: string; role: AppRole; companyId: string | null; branchId: string | null },
  captain: { companyId: string; branchId: string; createdByUserId?: string | null },
): Promise<void> {
  if (!isOrderOperatorRole(actor.role)) return;
  if (isSuperAdminRole(actor.role)) return;
  const scope = await resolveStaffTenantOrderListFilter(actor);
  if (scope.companyId && captain.companyId !== scope.companyId) {
    throw new AppError(403, "Forbidden", "FORBIDDEN");
  }
  if (scope.branchId && captain.branchId !== scope.branchId) {
    throw new AppError(403, "Forbidden", "FORBIDDEN");
  }
  /** COMPANY_ADMIN: company (and optional branch) match is sufficient — Phase 3.2.2. */
}
