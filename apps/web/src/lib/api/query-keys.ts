/** مفاتيح React Query — تُستخدم للجلب، التحميل المسبق، والإبطال المركزي */
export const queryKeys = {
  root: ["captain-app"] as const,

  orders: {
    root: ["orders"] as const,
    list: (params: OrdersListParams) => ["orders", "list", params] as const,
    detail: (id: string) => ["orders", "detail", id] as const,
  },

  captains: {
    root: ["captains"] as const,
    list: (params: CaptainsListParams) => ["captains", "list", params] as const,
    stats: (id: string) => ["captains", "stats", id] as const,
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
    activeMap: () => ["tracking", "active-map"] as const,
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

export type UsersListParams = {
  page?: number;
  pageSize?: number;
  role?: string;
};
