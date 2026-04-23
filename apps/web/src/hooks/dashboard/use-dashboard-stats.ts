import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import { loadDashboardStats } from "@/lib/dashboard-stats";
import { canListOrdersRole, isDispatchRole } from "@/lib/rbac-roles";
import { useAuthStore } from "@/stores/auth-store";

export function useDashboardStats() {
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.user?.role);
  const canListOrders = canListOrdersRole(role);
  const isDispatch = isDispatchRole(role);

  return useQuery({
    queryKey: [...queryKeys.dashboard.stats(), { canListOrders, isDispatch }],
    queryFn: () => loadDashboardStats({ canListOrders, isDispatch }),
    enabled: Boolean(token),
  });
}
