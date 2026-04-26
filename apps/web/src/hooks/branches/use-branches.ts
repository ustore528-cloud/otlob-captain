import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import { api } from "@/lib/api/singleton";

/**
 * Active branches the current user may assign for captain creation.
 * `companyId` is only for SUPER_ADMIN when filtering; ignored for other roles.
 */
export function useBranches(companyId?: string, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.branches.list(companyId),
    queryFn: () => api.branches.list({ companyId }),
    enabled: opts?.enabled !== false,
  });
}
