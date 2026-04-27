import type { AppRole } from "../lib/rbac-roles.js";

export type Capability =
  | "users.read"
  | "users.create"
  | "users.toggleActive"
  | "orders.read"
  | "orders.create"
  | "orders.dispatch"
  | "captains.read"
  | "captains.manage"
  | "stores.read"
  | "stores.manage"
  | "finance.read"
  | "finance.write"
  | "reports.read"
  | "settings.read"
  | "settings.write";

type RoleMatrix = Record<Capability, boolean>;

function matrix(overrides: Partial<RoleMatrix>): RoleMatrix {
  const base: RoleMatrix = {
    "users.read": false,
    "users.create": false,
    "users.toggleActive": false,
    "orders.read": false,
    "orders.create": false,
    "orders.dispatch": false,
    "captains.read": false,
    "captains.manage": false,
    "stores.read": false,
    "stores.manage": false,
    "finance.read": false,
    "finance.write": false,
    "reports.read": false,
    "settings.read": false,
    "settings.write": false,
  };
  return { ...base, ...overrides };
}

export const ROLE_CAPABILITIES: Record<AppRole, RoleMatrix> = {
  SUPER_ADMIN: matrix({
    "users.read": true,
    "users.create": true,
    "users.toggleActive": true,
    "orders.read": true,
    "orders.create": true,
    "orders.dispatch": true,
    "captains.read": true,
    "captains.manage": true,
    "stores.read": true,
    "stores.manage": true,
    "finance.read": true,
    "finance.write": true,
    "reports.read": true,
    "settings.read": true,
    "settings.write": true,
  }),
  COMPANY_ADMIN: matrix({
    "orders.read": true,
    "captains.read": true,
    "captains.manage": true,
    /** Storeless dashboard: create uses server-resolved operational store (no client storeId). */
    "orders.create": true,
    /** Distribution map + tracking (tenant-scoped server-side; Phase 3.2.1). */
    "orders.dispatch": true,
    "stores.read": false,
    "stores.manage": false,
    "finance.read": false,
    "finance.write": false,
    "reports.read": false,
    "settings.read": false,
    "settings.write": false,
  }),
  // Deprecated/compatibility roles remain non-destructive but inactive in the new active UI model.
  BRANCH_MANAGER: matrix({
    "orders.read": false,
  }),
  DISPATCHER: matrix({
    "orders.read": false,
  }),
  STORE_ADMIN: matrix({
    "orders.read": true,
    "orders.create": true,
    "stores.read": false,
    "finance.read": false,
  }),
  STORE_USER: matrix({
    "orders.read": true,
    "orders.create": true,
    "stores.read": false,
    "finance.read": false,
  }),
  CAPTAIN_SUPERVISOR: matrix({
    "orders.read": false,
  }),
  CAPTAIN: matrix({
    "orders.read": true,
    "captains.read": true,
  }),
  CUSTOMER: matrix({
    "orders.read": true,
    "orders.create": true,
  }),
  ADMIN: matrix({
    "users.read": true,
    "users.create": true,
    "users.toggleActive": true,
    "orders.read": true,
    "orders.create": true,
    "orders.dispatch": true,
    "captains.read": true,
    "captains.manage": true,
    "stores.read": true,
    "stores.manage": true,
    "finance.read": true,
    "reports.read": true,
    "settings.read": true,
    "settings.write": true,
  }),
  STORE: matrix({
    "orders.read": true,
    "orders.create": true,
    "stores.read": true,
    "finance.read": true,
  }),
};

export function hasCapability(role: AppRole, capability: Capability): boolean {
  return Boolean(ROLE_CAPABILITIES[role]?.[capability]);
}

export function rolesWithCapability(capability: Capability): AppRole[] {
  return (Object.keys(ROLE_CAPABILITIES) as AppRole[]).filter((role) => ROLE_CAPABILITIES[role][capability]);
}

