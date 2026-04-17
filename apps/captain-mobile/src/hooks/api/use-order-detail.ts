import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import type { OrderDetailDto } from "@/services/api/dto";
import { ordersService } from "@/services/api/services/orders.service";
import { queryKeys } from "./query-keys";

export function useOrderDetail(
  orderId: string | undefined,
  options?: Omit<UseQueryOptions<OrderDetailDto, Error>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: orderId ? queryKeys.orders.detail(orderId) : ["captain-mobile", "orders", "detail", "none"],
    queryFn: () => ordersService.getById(orderId!),
    enabled: Boolean(orderId),
    ...options,
  });
}
