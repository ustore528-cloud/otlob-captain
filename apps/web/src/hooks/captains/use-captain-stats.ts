import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import { api } from "@/lib/api/singleton";
import { useAuthStore } from "@/stores/auth-store";

export function useCaptainStats(captainId: string | null, options?: { enabled?: boolean }) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: captainId ? queryKeys.captains.stats(captainId) : ["captains", "stats", "none"],
    queryFn: () => api.captains.stats(captainId!),
    enabled: Boolean(captainId) && (options?.enabled ?? true) && Boolean(token),
  });
}
