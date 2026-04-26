/** REST base — يُحمّل عبر نفس النطاق أو `VITE_API_URL` */

export const API_V1 = "/api/v1" as const;

export const paths = {
  health: "/health",
  auth: {
    login: `${API_V1}/auth/login`,
    refresh: `${API_V1}/auth/refresh`,
    me: `${API_V1}/auth/me`,
    register: `${API_V1}/auth/register`,
  },
  users: {
    root: `${API_V1}/users`,
    byId: (id: string) => `${API_V1}/users/${id}`,
    active: (id: string) => `${API_V1}/users/${id}/active`,
    customerProfile: (id: string) => `${API_V1}/users/${id}/customer-profile`,
  },
  stores: {
    root: `${API_V1}/stores`,
    byId: (id: string) => `${API_V1}/stores/${id}`,
  },
  /** قائمة شركات نشطة — SUPER_ADMIN فقط */
  companies: {
    root: `${API_V1}/companies`,
  },
  branches: {
    root: `${API_V1}/branches`,
  },
  zones: {
    root: `${API_V1}/zones`,
  },
  public: {
    requestContext: (code: string) => `${API_V1}/public/request-context/${encodeURIComponent(code)}`,
    orders: `${API_V1}/public/orders`,
  },
  captains: {
    root: `${API_V1}/captains`,
    byId: (id: string) => `${API_V1}/captains/${id}`,
    active: (id: string) => `${API_V1}/captains/${id}/active`,
    availability: (id: string) => `${API_V1}/captains/${id}/availability`,
    stats: (id: string) => `${API_V1}/captains/${id}/stats`,
    orders: (id: string) => `${API_V1}/captains/${id}/orders`,
    prepaidBalance: (id: string) => `${API_V1}/captains/${id}/prepaid-balance`,
    prepaidSummary: (id: string) => `${API_V1}/captains/${id}/prepaid-summary`,
    prepaidTransactions: (id: string) => `${API_V1}/captains/${id}/prepaid-transactions`,
    prepaidCharge: (id: string) => `${API_V1}/captains/${id}/prepaid-charge`,
    prepaidAdjustment: (id: string) => `${API_V1}/captains/${id}/prepaid-adjustment`,
  },
  orders: {
    root: `${API_V1}/orders`,
    byId: (id: string) => `${API_V1}/orders/${id}`,
    archive: (id: string) => `${API_V1}/orders/${id}/archive`,
    unarchive: (id: string) => `${API_V1}/orders/${id}/unarchive`,
    status: (id: string) => `${API_V1}/orders/${id}/status`,
    reassign: (id: string) => `${API_V1}/orders/${id}/reassign`,
    distributionAuto: (id: string) => `${API_V1}/orders/${id}/distribution/auto`,
    distributionResend: (id: string) => `${API_V1}/orders/${id}/distribution/resend`,
    distributionManual: (id: string) => `${API_V1}/orders/${id}/distribution/manual`,
    distributionDragDrop: (id: string) => `${API_V1}/orders/${id}/distribution/drag-drop`,
    distributionCancelCaptain: (id: string) => `${API_V1}/orders/${id}/distribution/cancel-captain`,
    distributionAutoAssignVisible: `${API_V1}/orders/distribution/auto-assign-visible`,
    /** مسار إشرافي — ADMIN/DISPATCHER فقط (`POST` body: `{ status }`) */
    adminOverrideStatus: (id: string) => `${API_V1}/orders/${id}/override-status`,
  },
  tracking: {
    activeMap: `${API_V1}/tracking/captains/active-map`,
    latestLocations: `${API_V1}/tracking/locations/latest`,
  },
  notifications: {
    root: `${API_V1}/notifications`,
    read: (id: string) => `${API_V1}/notifications/${id}/read`,
    readAll: `${API_V1}/notifications/read-all`,
    quickStatus: `${API_V1}/notifications/quick-status`,
  },
  activity: {
    root: `${API_V1}/activity`,
  },
  dashboardSettings: {
    root: `${API_V1}/dashboard-settings`,
  },
  geocode: {
    place: `${API_V1}/geocode/place`,
  },
  superAdminWallets: {
    storeTopUp: (storeId: string) => `${API_V1}/super-admin/wallets/stores/${storeId}/top-up`,
    supervisorUserTopUp: (userId: string) => `${API_V1}/super-admin/wallets/supervisor-users/${userId}/top-up`,
    supervisorUserAdjustment: (userId: string) => `${API_V1}/super-admin/wallets/supervisor-users/${userId}/adjustment`,
    companyTopUp: (companyId: string) => `${API_V1}/super-admin/wallets/company/${companyId}/top-up`,
  },
  /** محفظة المشرف → كابتن (JWT: مشرف فرع/موزع) */
  supervisorWallets: {
    transferToCaptain: `${API_V1}/supervisor/wallets/transfers/to-captain`,
  },
  /** أرصدة ودفتر أستاذ (قراءة فقط) */
  finance: {
    storeWallet: (storeId: string) => `${API_V1}/finance/stores/${storeId}/wallet`,
    /** COMPANY_ADMIN — body: amount, reason, idempotencyKey, optional currency */
    companyAdminStoreTopUp: (storeId: string) => `${API_V1}/finance/stores/${storeId}/company-top-up`,
    captainWallet: (captainId: string) => `${API_V1}/finance/captains/${captainId}/wallet`,
    /** COMPANY_ADMIN / SUPER_ADMIN — body: amount, reason, idempotencyKey */
    companyAdminCaptainPrepaid: (captainId: string) => `${API_V1}/finance/captains/${captainId}/prepaid-charge`,
    supervisorMe: `${API_V1}/finance/wallets/supervisor/me`,
    companyWalletMe: `${API_V1}/finance/company-wallet/me`,
    companyWalletById: (companyId: string) => `${API_V1}/finance/company-wallet/${companyId}`,
    ledgerEntries: (walletAccountId: string) => `${API_V1}/finance/wallet-accounts/${walletAccountId}/ledger-entries`,
    ledgerActivity: (walletAccountId: string) => `${API_V1}/finance/wallet-accounts/${walletAccountId}/ledger-activity`,
  },
  /** تقارير تشغيلية (قراءة، موظفو تشغيل) */
  reports: {
    reconciliationSummary: `${API_V1}/reports/reconciliation-summary`,
    deliveredCommissions: `${API_V1}/reports/delivered-commissions`,
    ordersHistory: `${API_V1}/reports/orders-history`,
  },
  /** طلبات حساب العميل (JWT بدور CUSTOMER) */
  customer: {
    orders: `${API_V1}/customer/orders`,
  },
  /** مسارات مستقرة لتطبيق الكابتن (موبايل) — JWT نفس `/auth` */
  mobileCaptain: {
    login: `${API_V1}/mobile/captain/auth/login`,
    refresh: `${API_V1}/mobile/captain/auth/refresh`,
    me: `${API_V1}/mobile/captain/me`,
    prepaidSummary: `${API_V1}/mobile/captain/me/prepaid-summary`,
    workStatus: `${API_V1}/mobile/captain/me/work-status`,
    /** Singular live snapshot (NONE | one OFFER | one ACTIVE) — not a multi-order queue. */
    assignment: `${API_V1}/mobile/captain/me/assignment`,
    /** Secondary assignable / in-flight orders not shown on the primary assignment card (Option C). */
    assignmentOverflow: `${API_V1}/mobile/captain/me/assignment/overflow`,
    pushToken: `${API_V1}/mobile/captain/me/push-token`,
    availability: `${API_V1}/mobile/captain/me/availability`,
    location: `${API_V1}/mobile/captain/me/location`,
    orderById: (orderId: string) => `${API_V1}/mobile/captain/orders/${orderId}`,
    acceptOrder: (orderId: string) => `${API_V1}/mobile/captain/orders/${orderId}/accept`,
    rejectOrder: (orderId: string) => `${API_V1}/mobile/captain/orders/${orderId}/reject`,
    orderStatus: (orderId: string) => `${API_V1}/mobile/captain/orders/${orderId}/status`,
    orderHistory: `${API_V1}/mobile/captain/orders/history`,
    earningsSummary: `${API_V1}/mobile/captain/earnings/summary`,
  },
} as const;
