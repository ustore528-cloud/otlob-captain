import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import { loadDashboardStats } from "@/lib/dashboard-stats";
import { useAuthStore } from "@/stores/auth-store";

export function useDashboardStats() {
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.user?.role);
  const canListOrders = Boolean(role && (role === "ADMIN" || role === "DISPATCHER" || role === "STORE"));
  const isDispatch = role === "ADMIN" || role === "DISPATCHER";

  return useQuery({
    queryKey: [...queryKeys.dashboard.stats(), { canListOrders, isDispatch }],
    queryFn: () => loadDashboardStats({ canListOrders, isDispatch }),
    enabled: Boolean(token),
  });
}
