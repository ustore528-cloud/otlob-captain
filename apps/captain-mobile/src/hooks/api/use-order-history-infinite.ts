import {
  useInfiniteQuery,
  type InfiniteData,
  type UseInfiniteQueryOptions,
} from "@tanstack/react-query";
import type { OrderHistoryQuery, OrderHistoryResponse } from "@/services/api/dto";
import { ordersService } from "@/services/api/services/orders.service";
import { queryKeys } from "./query-keys";

const DEFAULT_PAGE_SIZE = 20;

export type OrderHistoryFilters = {
  status?: OrderHistoryQuery["status"];
  from?: string;
  to?: string;
};

function hashFilters(f: OrderHistoryFilters, pageSize: number): string {
  return JSON.stringify({ ...f, pageSize });
}

/**
 * سجل الطلبات مع التصفح اللانهائي — يتوافق مع GET /mobile/captain/orders/history
 */
export function useOrderHistoryInfinite(
  filters: OrderHistoryFilters,
  pageSize: number = DEFAULT_PAGE_SIZE,
  options?: Omit<
    UseInfiniteQueryOptions<
      OrderHistoryResponse,
      Error,
      InfiniteData<OrderHistoryResponse>,
      readonly unknown[],
      number
    >,
    "queryKey" | "queryFn" | "initialPageParam" | "getNextPageParam"
  >,
) {
  const fh = hashFilters(filters, pageSize);

  return useInfiniteQuery({
    queryKey: queryKeys.orders.historyInfinite(fh),
    queryFn: ({ pageParam }) =>
      ordersService.history({
        page: pageParam,
        pageSize,
        status: filters.status,
        from: filters.from,
        to: filters.to,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) => {
      const { page, totalPages } = last.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
    ...options,
  });
}
