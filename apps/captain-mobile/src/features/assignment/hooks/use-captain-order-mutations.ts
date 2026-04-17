import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CaptainOrderStatusBody } from "@/services/api/dto";
import { ordersService } from "@/services/api/services/orders.service";
import { queryKeys } from "@/hooks/api/query-keys";

export function useCaptainOrderMutations() {
  const queryClient = useQueryClient();

  const invalidateOrder = (orderId: string) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.captain.assignment });
    void queryClient.invalidateQueries({ queryKey: queryKeys.captain.me });
    void queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) });
    void queryClient.invalidateQueries({ queryKey: ["captain-mobile", "orders", "historyInfinite"] });
    void queryClient.invalidateQueries({ queryKey: ["captain-mobile", "orders", "history"] });
    void queryClient.invalidateQueries({ queryKey: ["captain-mobile", "earnings", "summary"] });
  };

  const accept = useMutation({
    mutationFn: (orderId: string) => ordersService.accept(orderId),
    onSuccess: (_data, orderId) => invalidateOrder(orderId),
  });

  const reject = useMutation({
    mutationFn: (orderId: string) => ordersService.reject(orderId),
    onSuccess: (_data, orderId) => invalidateOrder(orderId),
  });

  const updateStatus = useMutation({
    mutationFn: (args: { orderId: string; body: CaptainOrderStatusBody }) =>
      ordersService.updateStatus(args.orderId, args.body),
    onSuccess: (_data, args) => invalidateOrder(args.orderId),
  });

  const pending = accept.isPending || reject.isPending || updateStatus.isPending;

  return { accept, reject, updateStatus, pending };
}
