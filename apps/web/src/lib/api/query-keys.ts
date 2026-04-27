/** مفاتيح React Query — تُستخدم للجلب، التحميل المسبق، والإبطال المركزي */
export const queryKeys = {
  root: ["captain-app"] as const,

  orders: {
    root: ["orders"] as const,
    list: (params: OrdersListParams) => ["orders", "list", params] as const,
    detail: (id: string) => ["orders", "detail", id] as const,
  },

  companies: {
    root: ["companies"] as const,
    list: () => ["companies", "list"] as const,
    deletePreview: (companyId: string) => ["companies", "deletePreview", companyId] as const,
  },

  branches: {
    root: ["branches"] as const,
    list: (companyId?: string) => ["branches", "list", companyId ?? ""] as const,
  },

  zones: {
    root: ["zones"] as const,
    list: (companyId?: string) => ["zones", "list", companyId ?? ""] as const,
  },

  captains: {
    root: ["captains"] as const,
    list: (params: CaptainsListParams) => ["captains", "list", params] as const,
    stats: (id: string) => ["captains", "stats", id] as const,
    orders: (captainId: string, params: CaptainOrdersQueryParams) =>
      ["captains", captainId, "orders", params] as const,
  },

  users: {
    root: ["users"] as const,
    list: (params: UsersListParams) => ["users", "list", params] as const,
  },

  stores: {
    root: ["stores"] as const,
    list: (page: number, pageSize: number) => ["stores", "list", page, pageSize] as const,
  },

  tracking: {
    root: ["tracking"] as const,
    /** v2: يتضمّن `userId` / `user.id` — غيّر المفتاح عند تغيير شكل الـ payload لإبطال كاش قديم */
    activeMap: () => ["tracking", "active-map", "v2"] as const,
    latestLocations: (captainIds: string[]) => ["tracking", "latest", [...captainIds].sort().join(",")] as const,
  },

  notifications: {
    root: ["notifications"] as const,
    list: (page: number, pageSize: number) => ["notifications", "list", page, pageSize] as const,
  },

  activity: {
    root: ["activity"] as const,
    list: (page: number, pageSize: number) => ["activity", "list", page, pageSize] as const,
  },

  dashboard: {
    root: ["dashboard"] as const,
    stats: () => ["dashboard", "stats"] as const,
    settings: () => ["dashboard", "settings"] as const,
  },

  reports: {
    root: ["reports"] as const,
    reconciliation: (from: string, to: string) => ["reports", "reconciliation", from, to] as const,
    prepaidBook: (captainId: string, from: string, to: string, page: number) =>
      ["reports", "prepaid-book", captainId, from, to, page] as const,
    deliveredCommissions: (from: string, to: string, page: number) =>
      ["reports", "delivered-commissions", from, to, page] as const,
    ordersHistory: (
      from: string,
      to: string,
      page: number,
      pageSize: number,
      captainId?: string,
      storeId?: string,
      status?: string,
    ) => ["reports", "orders-history", from, to, page, pageSize, captainId ?? "", storeId ?? "", status ?? ""] as const,
  },

  finance: {
    root: ["finance"] as const,
    storeWallet: (storeId: string) => ["finance", "store-wallet", storeId] as const,
    captainWallet: (captainId: string) => ["finance", "captain-wallet", captainId] as const,
    supervisorMe: () => ["finance", "supervisor-me"] as const,
    companyWalletMe: () => ["finance", "company-wallet", "me"] as const,
    companyWalletById: (companyId: string) => ["finance", "company-wallet", companyId] as const,
    /** صفحة أولى فقط (offset 0) — التحميل التالي عبر `load more`. */
    ledgerFirstPage: (walletAccountId: string) => ["finance", "ledger", walletAccountId, 0] as const,
    /** تقرير الحركات بالفترة — offset 0 فقط لأول دفعة؛ باقي التحميل لاحقياً. */
    ledgerActivityFirstPage: (walletAccountId: string, from: string, to: string) =>
      ["finance", "ledger-activity", walletAccountId, from, to, 0] as const,
  },
} as const;

export type OrdersListParams = {
  page?: number;
  pageSize?: number;
  status?: string;
  area?: string;
  orderNumber?: string;
  customerPhone?: string;
  storeId?: string;
};

export type CaptainsListParams = {
  page?: number;
  pageSize?: number;
  area?: string;
  isActive?: boolean;
  availabilityStatus?: string;
};

export type CaptainOrdersQueryParams = {
  page?: number;
  pageSize?: number;
  from?: string;
  to?: string;
  q?: string;
  area?: string;
  status?: string;
};

export type UsersListParams = {
  page?: number;
  pageSize?: number;
  role?: string;
};
