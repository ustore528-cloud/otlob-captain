import { useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { queryKeys } from "@/hooks/api/query-keys";
import { captainService } from "@/services/api/services/captain.service";
import { queryClient } from "@/lib/query-client";

/**
 * Latest admin quick work-status broadcast (same source as the admin dashboard quick alert).
 * Polls on an interval and refetches when the app returns to the foreground.
 */
export function useCaptainWorkStatus() {
  const { sessionReady, isAuthenticated } = useAuth();

  const query = useQuery({
    queryKey: queryKeys.captain.workStatus,
    queryFn: () => captainService.getWorkStatus(),
    enabled: sessionReady && isAuthenticated,
    staleTime: 25_000,
    refetchInterval: 15_000,
  });

  useEffect(() => {
    const onChange = (s: AppStateStatus) => {
      if (s === "active" && sessionReady && isAuthenticated) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.captain.workStatus });
      }
    };
    const sub = AppState.addEventListener("change", onChange);
    return () => sub.remove();
  }, [sessionReady, isAuthenticated]);

  return query;
}
