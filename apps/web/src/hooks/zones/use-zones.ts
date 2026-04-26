import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import { api } from "@/lib/api/singleton";

export function useZones(companyId?: string, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.zones.list(companyId),
    queryFn: () => api.zones.list({ companyId }),
    enabled: opts?.enabled !== false,
  });
}
