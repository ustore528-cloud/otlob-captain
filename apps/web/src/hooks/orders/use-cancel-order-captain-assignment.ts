import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateOrderDistributionDomain } from "@/lib/invalidate-order-domain";
import { api } from "@/lib/api/singleton";
import { toastApiError, toastSuccess } from "@/lib/toast";

export function useCancelOrderCaptainAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => api.orders.distributionCancelCaptain(orderId),
    onSuccess: async () => {
      toastSuccess("تم إلغاء الطلب للكابتن");
      await invalidateOrderDistributionDomain(qc);
    },
    onError: (e) => toastApiError(e, "تعذر إلغاء الطلب للكابتن"),
  });
}
