import type { WalletAccount } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/errors.js";
import { isOrderOperatorRole, isStoreAdminRole, isSuperAdminRole, type AppRole } from "../lib/rbac-roles.js";
import { assertStaffCanAccessCaptain, resolveStaffTenantOrderListFilter } from "./tenant-scope.service.js";

const STORE_BALANCE_ROLES: AppRole[] = [
  "SUPER_ADMIN",
  "STORE_ADMIN",
  "STORE_USER",
] as const;

const CAPTAIN_BALANCE_ROLES: AppRole[] = [
  "SUPER_ADMIN",
] as const;

const SUPERVISOR_ME_ROLES: AppRole[] = ["SUPER_ADMIN"] as const;

function assertRoleIn(role: AppRole, allowed: readonly AppRole[]): void {
  if (!allowed.includes(role)) {
    throw new AppError(403, "Forbidden", "FORBIDDEN");
  }
}

/**
 * Super admin: any store. Order operators: company/branch scope. Store admin/legacy store: own store only.
 */
export async function assertCanReadStoreWallet(
  role: AppRole,
  userId: string,
  companyId: string | null,
  branchId: string | null,
  store: { id: string; companyId: string; branchId: string; ownerUserId: string },
): Promise<void> {
  assertRoleIn(role, STORE_BALANCE_ROLES);
  if (isSuperAdminRole(role)) return;
  if (isOrderOperatorRole(role) && !isStoreAdminRole(role)) {
    const tenant = await resolveStaffTenantOrderListFilter({
      userId,
      role,
      companyId,
      branchId,
    });
    if (tenant.companyId && store.companyId !== tenant.companyId) {
      throw new AppError(403, "Forbidden", "FORBIDDEN");
    }
    if (tenant.branchId && store.branchId !== tenant.branchId) {
      throw new AppError(403, "Forbidden", "FORBIDDEN");
    }
    return;
  }
  if (isStoreAdminRole(role)) {
    if (store.ownerUserId !== userId) {
      throw new AppError(403, "Forbidden", "FORBIDDEN");
    }
    return;
  }
  throw new AppError(403, "Forbidden", "FORBIDDEN");
}

/**
 * Company-scoped order operators; super admin any captain in DB.
 */
export async function assertCanReadCaptainWallet(
  role: AppRole,
  userId: string,
  companyId: string | null,
  branchId: string | null,
  captain: { id: string; companyId: string; branchId: string; createdByUserId?: string | null },
): Promise<void> {
  assertRoleIn(role, CAPTAIN_BALANCE_ROLES);
  if (isSuperAdminRole(role)) return;
  await assertStaffCanAccessCaptain({ userId, role, companyId, branchId }, captain);
}

export function assertCanReadMySupervisorWallet(role: AppRole, companyId: string | null): void {
  assertRoleIn(role, SUPERVISOR_ME_ROLES);
  if (companyId == null || companyId === "") {
    throw new AppError(400, "Company scope is required", "COMPANY_SCOPE_REQUIRED");
  }
}

/**
 * Same visibility rules as the balance APIs for the underlying owner.
 */
export async function assertCanReadWalletAccount(
  role: AppRole,
  userId: string,
  companyId: string | null,
  branchId: string | null,
  account: WalletAccount,
): Promise<void> {
  if (account.ownerType === "STORE") {
    const store = await prisma.store.findUnique({
      where: { id: account.ownerId },
      select: { id: true, companyId: true, branchId: true, ownerUserId: true },
    });
    if (!store) {
      throw new AppError(404, "Store not found", "NOT_FOUND");
    }
    if (store.companyId !== account.companyId) {
      throw new AppError(500, "Wallet store mismatch", "INTERNAL");
    }
    await assertCanReadStoreWallet(role, userId, companyId, branchId, store);
    return;
  }
  if (account.ownerType === "CAPTAIN") {
    const captain = await prisma.captain.findUnique({
      where: { id: account.ownerId },
      select: { id: true, companyId: true, branchId: true, createdByUserId: true },
    });
    if (!captain) {
      throw new AppError(404, "Captain not found", "NOT_FOUND");
    }
    if (captain.companyId !== account.companyId) {
      throw new AppError(500, "Wallet captain mismatch", "INTERNAL");
    }
    await assertCanReadCaptainWallet(role, userId, companyId, branchId, captain);
    return;
  }
  if (account.ownerType === "SUPERVISOR_USER") {
    assertCanReadMySupervisorWallet(role, companyId);
    if (account.ownerId !== userId) {
      throw new AppError(403, "Forbidden", "FORBIDDEN");
    }
    if (account.companyId !== companyId) {
      throw new AppError(403, "Forbidden", "FORBIDDEN");
    }
    return;
  }
  throw new AppError(403, "Forbidden", "FORBIDDEN");
}
