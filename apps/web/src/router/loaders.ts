import { queryKeys } from "@/lib/api/query-keys";
import { api } from "@/lib/api/singleton";
import { loadDashboardStats } from "@/lib/dashboard-stats";
import { queryClient } from "@/lib/query-client";
import { useAuthStore } from "@/stores/auth-store";

/** مطابق لمفتاح قائمة الطلبات الافتراضي في صفحة الطلبات — للتحميل المسبق */
export const ORDERS_PAGE_INITIAL_LIST_PARAMS = { page: 1, pageSize: 50, status: "", orderNumber: "", customerPhone: "" };

export async function homeLoader() {
  const token = useAuthStore.getState().token;
  if (!token) return null;
  const user = useAuthStore.getState().user;
  const role = user?.role;
  const canListOrders = Boolean(role && (role === "ADMIN" || role === "DISPATCHER" || role === "STORE"));
  const isDispatch = role === "ADMIN" || role === "DISPATCHER";

  await queryClient.prefetchQuery({
    queryKey: [...queryKeys.dashboard.stats(), { canListOrders, isDispatch }],
    queryFn: () => loadDashboardStats({ canListOrders, isDispatch }),
  });

  await queryClient.prefetchQuery({
    queryKey: queryKeys.notifications.list(1, 1),
    queryFn: () => api.notifications.list(1, 1),
  });

  if (isDispatch) {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.activity.list(1, 8),
      queryFn: () => api.activity.list(1, 8),
    });
  }
  return null;
}

export async function ordersLoader() {
  if (!useAuthStore.getState().token) return null;
  await queryClient.prefetchQuery({
    queryKey: queryKeys.orders.list(ORDERS_PAGE_INITIAL_LIST_PARAMS),
    queryFn: () => api.orders.list({ page: 1, pageSize: 50 }),
  });
  return null;
}

export async function newOrderLoader() {
  if (!useAuthStore.getState().token) return null;
  await queryClient.prefetchQuery({
    queryKey: queryKeys.stores.list(1, 200),
    queryFn: () => api.stores.list(1, 200),
  });
  return null;
}

export async function distributionLoader() {
  const token = useAuthStore.getState().token;
  const role = useAuthStore.getState().user?.role;
  if (!token || (role !== "ADMIN" && role !== "DISPATCHER")) return null;

  const p1 = { page: 1, pageSize: 80, status: "PENDING", orderNumber: "", customerPhone: "" };
  const p2 = { page: 1, pageSize: 80, status: "CONFIRMED", orderNumber: "", customerPhone: "" };
  await Promise.all([
    queryClient.prefetchQuery({ queryKey: queryKeys.orders.list(p1), queryFn: () => api.orders.list(p1) }),
    queryClient.prefetchQuery({ queryKey: queryKeys.orders.list(p2), queryFn: () => api.orders.list(p2) }),
    queryClient.prefetchQuery({ queryKey: queryKeys.tracking.activeMap(), queryFn: () => api.tracking.activeMap() }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.captains.list({ page: 1, pageSize: 200 }),
      queryFn: () => api.captains.list({ page: 1, pageSize: 200 }),
    }),
  ]);
  return null;
}

export async function captainsLoader() {
  const token = useAuthStore.getState().token;
  const role = useAuthStore.getState().user?.role;
  if (!token || (role !== "ADMIN" && role !== "DISPATCHER")) return null;
  await queryClient.prefetchQuery({
    queryKey: queryKeys.captains.list({ page: 1, pageSize: 100 }),
    queryFn: () => api.captains.list({ page: 1, pageSize: 100 }),
  });
  return null;
}

export async function usersLoader() {
  const token = useAuthStore.getState().token;
  const role = useAuthStore.getState().user?.role;
  if (!token || (role !== "ADMIN" && role !== "DISPATCHER")) return null;
  const params = { page: 1, pageSize: 80, role: "" };
  await queryClient.prefetchQuery({
    queryKey: queryKeys.users.list(params),
    queryFn: () => api.users.list({ page: 1, pageSize: 80 }),
  });
  return null;
}
