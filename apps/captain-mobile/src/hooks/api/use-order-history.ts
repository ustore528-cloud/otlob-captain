import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import type { OrderHistoryQuery, OrderHistoryResponse } from "@/services/api/dto";
import { ordersService } from "@/services/api/services/orders.service";
import { queryKeys } from "./query-keys";

function hashQuery(q?: OrderHistoryQuery): string {
  return JSON.stringify(q ?? {});
}

export function useOrderHistory(
  query?: OrderHistoryQuery,
  options?: Omit<UseQueryOptions<OrderHistoryResponse, Error>, "queryKey" | "queryFn">,
) {
  const qh = hashQuery(query);
  return useQuery({
    queryKey: queryKeys.orders.history(qh),
    queryFn: () => ordersService.history(query),
    ...options,
  });
}
