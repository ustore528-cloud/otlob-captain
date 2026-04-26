type AppRole =
  | "SUPER_ADMIN"
  | "COMPANY_ADMIN"
  | "BRANCH_MANAGER"
  | "CAPTAIN_SUPERVISOR"
  | "STORE_ADMIN"
  | "STORE_USER"
  | "DISPATCHER"
  | "CAPTAIN"
  | "CUSTOMER"
  | "ADMIN"
  | "STORE";

type Capability =
  | "users.access"
  | "dashboard.read"
  | "captains.read"
  | "captains.charge"
  | "orders.list"
  | "dispatch.access"
  | "stores.manage"
  | "finance.read"
  | "finance.supervisorMe"
  | "finance.captainRead"
  | "finance.storeRead"
  | "reports.read"
  | "incubator.access";

const ROLE_CAPABILITIES: Record<AppRole, Set<Capability>> = {
  SUPER_ADMIN: new Set([
    "users.access",
    "dashboard.read",
    "captains.read",
    "captains.charge",
    "orders.list",
    "dispatch.access",
    "stores.manage",
    "finance.read",
    "finance.storeRead",
    "finance.captainRead",
    "reports.read",
    "incubator.access",
  ]),
  COMPANY_ADMIN: new Set([
    "dashboard.read",
    "captains.read",
    "captains.charge",
    "orders.list",
    /** محفظة الشركة (قراءة فقط) — `GET /finance/company-wallet/me` */
    "finance.read",
    /** تبويبات المالية: أرصدة متجر/كابتن + شحن عبر `POST /finance/.../company-top-up` و`prepaid-charge` */
    "finance.storeRead",
    "finance.captainRead",
  ]),
  BRANCH_MANAGER: new Set([]),
  CAPTAIN_SUPERVISOR: new Set([]),
  DISPATCHER: new Set([]),
  STORE_ADMIN: new Set([]),
  STORE_USER: new Set([]),
  CAPTAIN: new Set([]),
  CUSTOMER: new Set([]),
  ADMIN: new Set(["users.access", "orders.list", "dashboard.read", "captains.read"]),
  STORE: new Set([]),
};

function asRole(role?: string | null): AppRole | null {
  if (!role) return null;
  return role as AppRole;
}

function can(role: string | null | undefined, capability: Capability): boolean {
  const r = asRole(role);
  if (!r) return false;
  return ROLE_CAPABILITIES[r]?.has(capability) ?? false;
}

export function isSuperAdminRole(role?: string | null): boolean {
  return role === "SUPER_ADMIN";
}

export function isCompanyAdminRole(role?: string | null): boolean {
  return role === "COMPANY_ADMIN";
}

export function isBranchManagerRole(role?: string | null): boolean {
  return role === "BRANCH_MANAGER";
}

export function isStoreAdminRole(role?: string | null): boolean {
  return role === "STORE_ADMIN" || role === "STORE_USER";
}

export function isManagementAdminRole(role?: string | null): boolean {
  return role === "SUPER_ADMIN" || role === "COMPANY_ADMIN" || role === "ADMIN";
}

export function isDispatchRole(role?: string | null): boolean {
  return can(role, "dispatch.access");
}

export function canListOrdersRole(role?: string | null): boolean {
  return can(role, "orders.list");
}

export function canAccessCaptainsPage(role?: string | null): boolean {
  return can(role, "captains.read");
}

export function canChargeCaptainBalance(role?: string | null): boolean {
  return can(role, "captains.charge");
}

export function canAccessDashboardSummary(role?: string | null): boolean {
  return can(role, "dashboard.read");
}

export function canAccessUsersPage(role?: string | null): boolean {
  return can(role, "users.access");
}

/** مسار GET `/finance/wallets/supervisor/me` — المشرفون المرتبطون بالشركة. */
export function isSupervisorFinanceRole(role?: string | null): boolean {
  return can(role, "finance.supervisorMe");
}

/** واجهة محفظة متجر (يمكن للمشرفين والمتجر) — مطابقة سمة القراءة في الـ API. */
export function canReadStoreWalletUi(role?: string | null): boolean {
  return can(role, "finance.storeRead");
}

export function canReadCaptainWalletUi(role?: string | null): boolean {
  return can(role, "finance.captainRead");
}

/** صفحة hub المالية: أي دور يستطيع قراءة أحد عروض الأرصدة. */
export function canAccessFinancePage(role?: string | null): boolean {
  return can(role, "finance.read");
}

/** تبويب محفظة الشركة — مدير الشركة (قراءة خاصتها) أو مدير النظام (باختيار الشركة). */
export function canViewCompanyWalletSection(role?: string | null): boolean {
  return isCompanyAdminRole(role) || isSuperAdminRole(role);
}

export function canAccessIncubatorHost(role?: string | null): boolean {
  return can(role, "incubator.access");
}
