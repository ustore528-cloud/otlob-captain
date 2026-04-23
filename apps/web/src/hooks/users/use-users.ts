import { useQuery } from "@tanstack/react-query";
import { queryKeys, type UsersListParams } from "@/lib/api/query-keys";
import { api } from "@/lib/api/singleton";
import { isDispatchRole } from "@/lib/rbac-roles";
import { useAuthStore } from "@/stores/auth-store";

function toListQuery(p: UsersListParams) {
  return {
    page: p.page ?? 1,
    pageSize: p.pageSize ?? 40,
    ...(p.role && p.role.length > 0 ? { role: p.role } : {}),
  };
}

export function useUsers(params: UsersListParams, options?: { enabled?: boolean }) {
  const token = useAuthStore((s) => s.token);
  const viewerRole = useAuthStore((s) => s.user?.role);
  const can = isDispatchRole(viewerRole);
  return useQuery({
    queryKey: queryKeys.users.list(params),
    queryFn: () => api.users.list(toListQuery(params)),
    enabled: (options?.enabled ?? true) && Boolean(token) && can,
  });
}
