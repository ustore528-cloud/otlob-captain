import type { UserRole } from "@prisma/client";

export type LegacyUserRole = "ADMIN" | "STORE";
export type AppRole = UserRole | LegacyUserRole;

export const ROLE_GROUPS = {
  superAdmins: ["SUPER_ADMIN"] as const,
  companyAdmins: ["COMPANY_ADMIN"] as const,
  branchManagers: ["BRANCH_MANAGER"] as const,
  storeAdmins: ["STORE_ADMIN"] as const,
  dispatchers: ["DISPATCHER"] as const,
  captains: ["CAPTAIN"] as const,
  customers: ["CUSTOMER"] as const,
  legacyAdmins: ["ADMIN"] as const,
  legacyStores: ["STORE"] as const,
  managementAdmins: ["SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_MANAGER"] as const,
  scopedStaff: ["COMPANY_ADMIN", "BRANCH_MANAGER", "DISPATCHER"] as const,
  orderOperators: ["SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_MANAGER", "DISPATCHER"] as const,
} as const;

export function isSuperAdminRole(role: AppRole): role is "SUPER_ADMIN" {
  return role === "SUPER_ADMIN";
}

export function isCompanyAdminRole(role: AppRole): role is "COMPANY_ADMIN" {
  return role === "COMPANY_ADMIN";
}

export function isBranchManagerRole(role: AppRole): role is "BRANCH_MANAGER" {
  return role === "BRANCH_MANAGER";
}

export function isStoreAdminRole(role: AppRole): role is "STORE_ADMIN" | "STORE" {
  return role === "STORE_ADMIN" || role === "STORE";
}

export function isDispatcherRole(role: AppRole): role is "DISPATCHER" {
  return role === "DISPATCHER";
}

export function isCaptainRole(role: AppRole): role is "CAPTAIN" {
  return role === "CAPTAIN";
}

export function isCustomerRole(role: AppRole): role is "CUSTOMER" {
  return role === "CUSTOMER";
}

export function isLegacyAdminRole(role: AppRole): role is "ADMIN" {
  return role === "ADMIN";
}

export function isManagementAdminRole(role: AppRole): boolean {
  return isSuperAdminRole(role) || isCompanyAdminRole(role) || isBranchManagerRole(role) || isLegacyAdminRole(role);
}

export function isScopedStaffRole(role: AppRole): boolean {
  return isCompanyAdminRole(role) || isBranchManagerRole(role) || isDispatcherRole(role) || isLegacyAdminRole(role);
}

export function isOrderOperatorRole(role: AppRole): boolean {
  return isSuperAdminRole(role) || isScopedStaffRole(role);
}

export function canManageCaptains(role: AppRole): boolean {
  return isOrderOperatorRole(role);
}

export function canManageStores(role: AppRole): boolean {
  return isManagementAdminRole(role);
}

export function canManageUsers(role: AppRole): boolean {
  return isManagementAdminRole(role);
}

export function canUseStaffTracking(role: AppRole): boolean {
  return isOrderOperatorRole(role);
}
