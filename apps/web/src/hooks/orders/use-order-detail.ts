import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import { api } from "@/lib/api/singleton";
import { useAuthStore } from "@/stores/auth-store";

export function useOrderDetail(orderId: string | null, options?: { enabled?: boolean }) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: orderId ? queryKeys.orders.detail(orderId) : ["orders", "detail", "__none__"],
    queryFn: () => api.orders.getById(orderId!),
    enabled: (options?.enabled ?? true) && Boolean(token && orderId),
  });
}
