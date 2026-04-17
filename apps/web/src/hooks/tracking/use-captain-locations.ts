import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import { api } from "@/lib/api/singleton";
import { useAuthStore } from "@/stores/auth-store";

export function useCaptainLocations(options?: {
  captainIds?: string[];
  enabledActiveMap?: boolean;
  enabledLatest?: boolean;
  /** تحديث دوري للخريطة (مثلاً صفحة التوزيع لمتابعة انتقال العرض بين الكباتن) */
  activeMapRefetchInterval?: number | false;
}) {
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.user?.role);
  const can = role === "ADMIN" || role === "DISPATCHER";
  const ids = options?.captainIds ?? [];

  const activeMap = useQuery({
    queryKey: queryKeys.tracking.activeMap(),
    queryFn: () => api.tracking.activeMap(),
    enabled: (options?.enabledActiveMap ?? true) && Boolean(token) && can,
    refetchInterval: options?.activeMapRefetchInterval,
  });

  const latestLocations = useQuery({
    queryKey: queryKeys.tracking.latestLocations(ids),
    queryFn: () => api.tracking.latestLocations(ids),
    enabled: (options?.enabledLatest ?? true) && Boolean(token) && can && ids.length > 0,
  });

  return { activeMap, latestLocations };
}
