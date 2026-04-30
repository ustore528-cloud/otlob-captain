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

/**
 * أدوار المنصّة المعتمَدة: SUPER_ADMIN ، COMPANY_ADMIN ، CAPTAIN فقط تحصل على قدرات إيجابية.
 * بقيّة القيم في AppRole موجودة للتوافق مع قاعدة البيانات — بدون امتيازات (403 على المسارات المعتمدة على القدرات).
 */
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
    "orders.create": true,
    "orders.dispatch": true,
    "stores.read": false,
    "stores.manage": false,
    "finance.read": false,
    "finance.write": false,
    "reports.read": false,
    "settings.read": false,
    "settings.write": false,
  }),
  CAPTAIN: matrix({
    /** قائمة الطلبيات مضيّقة في `ordersService.list` (تعيين + عروض/سجل). — قراءة قائمة كبتن الشركة ليست مفتوحة له. */
    "orders.read": true,
  }),

  BRANCH_MANAGER: matrix({}),
  DISPATCHER: matrix({}),
  CAPTAIN_SUPERVISOR: matrix({}),
  STORE_ADMIN: matrix({}),
  STORE_USER: matrix({}),
  CUSTOMER: matrix({}),
  ADMIN: matrix({}),
  STORE: matrix({}),
};

export function hasCapability(role: AppRole, capability: Capability): boolean {
  return Boolean(ROLE_CAPABILITIES[role]?.[capability]);
}

export function rolesWithCapability(capability: Capability): AppRole[] {
  return (Object.keys(ROLE_CAPABILITIES) as AppRole[]).filter((role) => ROLE_CAPABILITIES[role][capability]);
}
