import { useQuery } from "@tanstack/react-query";
import { queryKeys, type OrdersListParams } from "@/lib/api/query-keys";
import { api } from "@/lib/api/singleton";
import { useAuthStore } from "@/stores/auth-store";

function toListQuery(p: OrdersListParams) {
  return {
    page: p.page ?? 1,
    pageSize: p.pageSize ?? 20,
    ...(p.status ? { status: p.status } : {}),
    ...(p.area ? { area: p.area } : {}),
    ...(p.orderNumber ? { orderNumber: p.orderNumber } : {}),
    ...(p.customerPhone ? { customerPhone: p.customerPhone } : {}),
    ...(p.storeId ? { storeId: p.storeId } : {}),
  };
}

export function useOrders(params: OrdersListParams, options?: { enabled?: boolean }) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: queryKeys.orders.list(params),
    queryFn: () => api.orders.list(toListQuery(params)),
    enabled: (options?.enabled ?? true) && Boolean(token),
  });
}
