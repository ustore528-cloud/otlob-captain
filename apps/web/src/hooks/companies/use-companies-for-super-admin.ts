import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import { api } from "@/lib/api/singleton";

/** Active companies — SUPER_ADMIN company picker (empty if not super / disabled). */
export function useCompaniesForSuperAdmin(opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.companies.list(),
    queryFn: () => api.companies.list(),
    enabled: opts?.enabled !== false,
  });
}
