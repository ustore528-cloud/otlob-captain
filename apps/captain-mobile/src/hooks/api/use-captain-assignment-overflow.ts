import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import type { AssignmentOverflowResponse } from "@/services/api/dto";
import { captainService } from "@/services/api/services/captain.service";
import { queryKeys } from "./query-keys";

const REFETCH_MS = 12_000;

/**
 * GET /mobile/captain/me/assignment/overflow — orders not shown on the primary `/me/assignment` card.
 */
export function useCaptainAssignmentOverflow(
  options?: Omit<UseQueryOptions<AssignmentOverflowResponse, Error>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: queryKeys.captain.assignmentOverflow,
    queryFn: () => captainService.getAssignmentOverflow(),
    ...options,
    refetchInterval: options?.refetchInterval ?? REFETCH_MS,
    refetchIntervalInBackground: options?.refetchIntervalInBackground ?? false,
    refetchOnReconnect: options?.refetchOnReconnect ?? true,
  });
}
