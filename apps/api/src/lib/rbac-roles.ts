import type { UserRole } from "@prisma/client";
import { hasCapability } from "../rbac/permissions.js";

export type LegacyUserRole = "ADMIN" | "STORE";
export type TransitionalUserRole = "CAPTAIN_SUPERVISOR" | "STORE_USER";
export type AppRole = UserRole | TransitionalUserRole | LegacyUserRole;

export const ROLE_GROUPS = {
  superAdmins: ["SUPER_ADMIN"] as const,
  companyAdmins: ["COMPANY_ADMIN"] as const,
  // Legacy groups below are intentionally kept for compatibility reads/migrations only.
  branchManagers: ["BRANCH_MANAGER"] as const,
  storeAdmins: ["STORE_ADMIN", "STORE_USER"] as const,
  storeUsers: ["STORE_USER"] as const,
  dispatchers: ["DISPATCHER"] as const,
  captainSupervisors: ["CAPTAIN_SUPERVISOR"] as const,
  captains: ["CAPTAIN"] as const,
  customers: ["CUSTOMER"] as const,
  legacyAdmins: ["ADMIN"] as const,
  legacyStores: ["STORE"] as const,
  managementAdmins: ["SUPER_ADMIN", "COMPANY_ADMIN"] as const,
  scopedStaff: ["COMPANY_ADMIN"] as const,
  orderOperators: ["SUPER_ADMIN", "COMPANY_ADMIN"] as const,
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

export function isStoreAdminRole(role: AppRole): role is "STORE_ADMIN" | "STORE" | "STORE_USER" {
  // Legacy helper: store roles are not supported platform actors, but old rows/tokens may still exist.
  return role === "STORE_ADMIN" || role === "STORE" || role === "STORE_USER";
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

export function isManagementAdminRole(role: AppRole): boolean {
  return isSuperAdminRole(role) || isCompanyAdminRole(role);
}

/**
 * شركة + سوبر يديران قوائم الطلب والتوزيع بعزل شركة (ولا يشمل ذلك أدوارًا قديمة مثل ADMIN).
 */
export function isOrderOperatorRole(role: AppRole): boolean {
  return isSuperAdminRole(role) || isCompanyAdminRole(role);
}

const SUPPORTED_PLATFORM_ACTORS = new Set<AppRole>(["SUPER_ADMIN", "COMPANY_ADMIN", "CAPTAIN"]);

/** الأدوار المعتمدة لمنصة 2in: سوبر منصة، مدير شركة، كابتن فقط — الباقي legacy. */
export function isSupportedPlatformActorRole(role: AppRole): boolean {
  return SUPPORTED_PLATFORM_ACTORS.has(role);
}

/** حساب لوحة شركة أو سوبر (ليست دور كابتن). */
export function isAdminPanelStaffRole(role: AppRole): boolean {
  return isSuperAdminRole(role) || isCompanyAdminRole(role);
}

export function canManageCaptains(role: AppRole): boolean {
  return hasCapability(role, "captains.manage");
}

export function canManageStores(role: AppRole): boolean {
  return hasCapability(role, "stores.manage");
}

export function canManageUsers(role: AppRole): boolean {
  return hasCapability(role, "users.create");
}

export function canUseStaffTracking(role: AppRole): boolean {
  return hasCapability(role, "settings.read");
}
