import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import { api } from "@/lib/api/singleton";
import { isSuperAdminRole } from "@/lib/rbac-roles";
import { useAuthStore } from "@/stores/auth-store";

export function useDashboardSettings() {
  const token = useAuthStore((s) => s.token);
  const canAccess = useAuthStore((s) => {
    const r = s.user?.role;
    return isSuperAdminRole(r);
  });

  return useQuery({
    queryKey: queryKeys.dashboard.settings(),
    queryFn: () => api.dashboardSettings.get(),
    enabled: Boolean(token) && canAccess,
    staleTime: 60_000,
  });
}
