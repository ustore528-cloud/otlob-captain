import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import type { EarningsSummaryQuery, EarningsSummaryResponse } from "@/services/api/dto";
import { ordersService } from "@/services/api/services/orders.service";
import { queryKeys } from "./query-keys";

function hashQuery(q?: EarningsSummaryQuery): string {
  return JSON.stringify(q ?? {});
}

export function useEarningsSummary(
  query?: EarningsSummaryQuery,
  options?: Omit<UseQueryOptions<EarningsSummaryResponse, Error>, "queryKey" | "queryFn">,
) {
  const qh = hashQuery(query);
  return useQuery({
    queryKey: queryKeys.earnings.summary(qh),
    queryFn: () => ordersService.earningsSummary(query),
    ...options,
  });
}
