import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import type { MeResponse } from "@/services/api/dto";
import { captainService } from "@/services/api/services/captain.service";
import { queryKeys } from "./query-keys";

export function useCaptainMe(
  options?: Omit<UseQueryOptions<MeResponse, Error>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: queryKeys.captain.me,
    queryFn: () => captainService.getMe(),
    ...options,
  });
}
