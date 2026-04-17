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
  captains: {
    root: `${API_V1}/captains`,
    byId: (id: string) => `${API_V1}/captains/${id}`,
    active: (id: string) => `${API_V1}/captains/${id}/active`,
    availability: (id: string) => `${API_V1}/captains/${id}/availability`,
    stats: (id: string) => `${API_V1}/captains/${id}/stats`,
    orders: (id: string) => `${API_V1}/captains/${id}/orders`,
  },
  orders: {
    root: `${API_V1}/orders`,
    byId: (id: string) => `${API_V1}/orders/${id}`,
    status: (id: string) => `${API_V1}/orders/${id}/status`,
    reassign: (id: string) => `${API_V1}/orders/${id}/reassign`,
    distributionAuto: (id: string) => `${API_V1}/orders/${id}/distribution/auto`,
    distributionResend: (id: string) => `${API_V1}/orders/${id}/distribution/resend`,
    distributionManual: (id: string) => `${API_V1}/orders/${id}/distribution/manual`,
    distributionDragDrop: (id: string) => `${API_V1}/orders/${id}/distribution/drag-drop`,
    distributionCancelCaptain: (id: string) => `${API_V1}/orders/${id}/distribution/cancel-captain`,
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
  /** مسارات مستقرة لتطبيق الكابتن (موبايل) — JWT نفس `/auth` */
  mobileCaptain: {
    login: `${API_V1}/mobile/captain/auth/login`,
    refresh: `${API_V1}/mobile/captain/auth/refresh`,
    me: `${API_V1}/mobile/captain/me`,
    assignment: `${API_V1}/mobile/captain/me/assignment`,
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
