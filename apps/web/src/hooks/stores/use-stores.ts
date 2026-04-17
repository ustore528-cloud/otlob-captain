import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import { api } from "@/lib/api/singleton";
import { useAuthStore } from "@/stores/auth-store";

export function useStores(page = 1, pageSize = 100, options?: { enabled?: boolean }) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: queryKeys.stores.list(page, pageSize),
    queryFn: () => api.stores.list(page, pageSize),
    enabled: (options?.enabled ?? true) && Boolean(token),
  });
}
