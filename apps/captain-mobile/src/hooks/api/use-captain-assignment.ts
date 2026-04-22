import { useEffect, useRef } from "react";
import { keepPreviousData, useQuery, type UseQueryOptions } from "@tanstack/react-query";
import type { CurrentAssignmentResponse } from "@/services/api/dto";
import { captainService } from "@/services/api/services/captain.service";
import { logCaptainAssignment } from "@/lib/captain-assignment-debug";
import { queryKeys } from "./query-keys";

/**
 * Polls GET /mobile/captain/me/assignment — **one live snapshot** (NONE | OFFER | ACTIVE), not a multi-order queue.
 * استطلاع خفيف حتى يظهر التعيين الجديد حتى لو تأخّر أو فات حدث Socket
 */
const ASSIGNMENT_REFETCH_INTERVAL_MS = 12_000;

export function useCaptainAssignment(
  options?: Omit<UseQueryOptions<CurrentAssignmentResponse, Error>, "queryKey" | "queryFn">,
) {
  const prevStateRef = useRef<string | null>(null);

  const query = useQuery({
    queryKey: queryKeys.captain.assignment,
    queryFn: async () => {
      logCaptainAssignment("FETCH_START");
      try {
        const data = await captainService.getAssignment();
        logCaptainAssignment("FETCH_SUCCESS", {
          state: data.state,
          orderId: data.state !== "NONE" ? data.order?.id : undefined,
        });
        return data;
      } catch (e) {
        logCaptainAssignment("FETCH_ERROR", { message: e instanceof Error ? e.message : String(e) });
        throw e;
      }
    },
    ...options,
    /** Keeps last successful snapshot visible during refetch/invalidate (applied after caller `options` so it is not stripped by spread). */
    placeholderData: keepPreviousData,
    /** يضمن وصول التعيين من الخادم حتى مع بقاء المستخدم على نفس الشاشة أو تأخّر Socket */
    refetchInterval: options?.refetchInterval ?? ASSIGNMENT_REFETCH_INTERVAL_MS,
    refetchIntervalInBackground: options?.refetchIntervalInBackground ?? false,
    refetchOnReconnect: options?.refetchOnReconnect ?? true,
  });

  useEffect(() => {
    const s = query.data?.state ?? "NONE";
    const key = `${s}:${query.data && "order" in query.data ? query.data.order?.id : ""}`;
    if (prevStateRef.current !== key) {
      prevStateRef.current = key;
      logCaptainAssignment("DATA_UPDATED", {
        state: s,
        isFetching: query.isFetching,
        isError: query.isError,
      });
    }
  }, [query.data, query.isFetching, query.isError]);

  return query;
}
