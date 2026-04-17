import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import type { CurrentAssignmentResponse } from "@/services/api/dto";
import { captainService } from "@/services/api/services/captain.service";
import { queryKeys } from "./query-keys";

export function useCaptainAssignment(
  options?: Omit<UseQueryOptions<CurrentAssignmentResponse, Error>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: queryKeys.captain.assignment,
    queryFn: () => captainService.getAssignment(),
    ...options,
  });
}
