import { queryKeys } from "@/lib/api/query-keys";
import { api } from "@/lib/api/singleton";
import { loadDashboardStats } from "@/lib/dashboard-stats";
import {
  isAdminPanelRole,
  canAccessCaptainsPage,
  canAccessComplaintsPage,
  canAccessIncubatorHost,
  canAccessReportsPage,
  canAccessUsersPage,
  canListOrdersRole,
  isDispatchRole,
  isSuperAdminRole,
} from "@/lib/rbac-roles";
import { queryClient } from "@/lib/query-client";
import { useAuthStore } from "@/stores/auth-store";
import { redirect } from "react-router-dom";

/** مطابق لمفتاح قائمة الطلبات الافتراضي في صفحة الطلبات — للتحميل المسبق */
export const ORDERS_PAGE_INITIAL_LIST_PARAMS = { page: 1, pageSize: 50, status: "", orderNumber: "", customerPhone: "" };

export async function homeLoader() {
  const token = useAuthStore.getState().token;
  if (!token) return null;
  const user = useAuthStore.getState().user;
  const role = user?.role;
  if (!isAdminPanelRole(role)) return redirect("/forbidden");
  const canListOrders = canListOrdersRole(role);
  const isDispatch = isDispatchRole(role);

  void queryClient.prefetchQuery({
    queryKey: [...queryKeys.dashboard.stats(), { canListOrders, isDispatch }],
    queryFn: () => loadDashboardStats({ canListOrders, isDispatch }),
  });

  void queryClient.prefetchQuery({
    queryKey: queryKeys.notifications.list(1, 1),
    queryFn: () => api.notifications.list(1, 1),
  });

  if (isDispatch) {
    void queryClient.prefetchQuery({
      queryKey: queryKeys.activity.list(1, 8),
      queryFn: () => api.activity.list(1, 8),
    });
  }
  return null;
}

export async function ordersLoader() {
  const token = useAuthStore.getState().token;
  const role = useAuthStore.getState().user?.role;
  if (!token) return null;
  if (!isAdminPanelRole(role) || !canListOrdersRole(role)) return redirect("/forbidden");
  void queryClient.prefetchQuery({
    queryKey: queryKeys.orders.list(ORDERS_PAGE_INITIAL_LIST_PARAMS),
    queryFn: () =>
      api.orders.list({
        page: ORDERS_PAGE_INITIAL_LIST_PARAMS.page,
        pageSize: ORDERS_PAGE_INITIAL_LIST_PARAMS.pageSize,
        ...(ORDERS_PAGE_INITIAL_LIST_PARAMS.status ? { status: ORDERS_PAGE_INITIAL_LIST_PARAMS.status } : {}),
        ...(ORDERS_PAGE_INITIAL_LIST_PARAMS.orderNumber ? { orderNumber: ORDERS_PAGE_INITIAL_LIST_PARAMS.orderNumber } : {}),
        ...(ORDERS_PAGE_INITIAL_LIST_PARAMS.customerPhone ? { customerPhone: ORDERS_PAGE_INITIAL_LIST_PARAMS.customerPhone } : {}),
      }),
  });
  return null;
}

export async function newOrderLoader() {
  const token = useAuthStore.getState().token;
  const role = useAuthStore.getState().user?.role;
  if (!token) return null;
  if (!isAdminPanelRole(role) || !canListOrdersRole(role)) return redirect("/forbidden");
  return null;
}

export async function incubatorHostLoader() {
  const token = useAuthStore.getState().token;
  const role = useAuthStore.getState().user?.role;
  if (!token) return null;
  if (!isAdminPanelRole(role) || !canAccessIncubatorHost(role)) return redirect("/forbidden");
  return null;
}

export async function distributionLoader() {
  const token = useAuthStore.getState().token;
  const role = useAuthStore.getState().user?.role;
  if (!token) return null;
  if (!isAdminPanelRole(role) || !isDispatchRole(role)) return redirect("/forbidden");

  const p1 = { page: 1, pageSize: 80, status: "PENDING", orderNumber: "", customerPhone: "" };
  const p2 = { page: 1, pageSize: 80, status: "CONFIRMED", orderNumber: "", customerPhone: "" };
  void Promise.all([
    queryClient.prefetchQuery({ queryKey: queryKeys.orders.list(p1), queryFn: () => api.orders.list(p1) }),
    queryClient.prefetchQuery({ queryKey: queryKeys.orders.list(p2), queryFn: () => api.orders.list(p2) }),
    queryClient.prefetchQuery({ queryKey: queryKeys.tracking.activeMap(), queryFn: () => api.tracking.activeMap() }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.captains.list({ page: 1, pageSize: 100 }),
      queryFn: () => api.captains.list({ page: 1, pageSize: 100 }),
    }),
  ]);
  return null;
}

export async function captainsLoader() {
  const token = useAuthStore.getState().token;
  const role = useAuthStore.getState().user?.role;
  if (!token) return null;
  if (!isAdminPanelRole(role) || !canAccessCaptainsPage(role)) return redirect("/forbidden");
  void queryClient.prefetchQuery({
    queryKey: queryKeys.captains.list({ page: 1, pageSize: 100 }),
    queryFn: () => api.captains.list({ page: 1, pageSize: 100 }),
  });
  return null;
}

export async function storesLoader() {
  const token = useAuthStore.getState().token;
  const role = useAuthStore.getState().user?.role;
  if (!token) return null;
  if (!isAdminPanelRole(role) || !isDispatchRole(role)) return redirect("/forbidden");
  void queryClient.prefetchQuery({
    queryKey: queryKeys.stores.list(1, 100),
    queryFn: () => api.stores.list(1, 100),
  });
  return null;
}

export async function usersLoader() {
  const token = useAuthStore.getState().token;
  const role = useAuthStore.getState().user?.role;
  if (!token) return null;
  if (!isAdminPanelRole(role) || !canAccessUsersPage(role)) return redirect("/forbidden");
  const params = { page: 1, pageSize: 80, role: "" };
  void queryClient.prefetchQuery({
    queryKey: queryKeys.users.list(params),
    queryFn: () => api.users.list({ page: 1, pageSize: 80 }),
  });
  return null;
}

export async function reportsLoader() {
  const token = useAuthStore.getState().token;
  const role = useAuthStore.getState().user?.role;
  if (!token) return redirect("/login");
  if (!isAdminPanelRole(role) || !canAccessReportsPage(role)) return redirect("/forbidden");
  return null;
}

export async function complaintsLoader() {
  const token = useAuthStore.getState().token;
  const role = useAuthStore.getState().user?.role;
  if (!token) return redirect("/login");
  if (!isAdminPanelRole(role) || !canAccessComplaintsPage(role)) return redirect("/forbidden");
  return null;
}

export async function captainApplicationsLoader() {
  const token = useAuthStore.getState().token;
  const role = useAuthStore.getState().user?.role;
  if (!token) return redirect("/login");
  if (!isSuperAdminRole(role)) return redirect("/forbidden");
  return null;
}
