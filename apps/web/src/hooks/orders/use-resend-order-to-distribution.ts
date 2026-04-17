import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateOrderDistributionDomain } from "@/lib/invalidate-order-domain";
import { api } from "@/lib/api/singleton";
import { toastApiError, toastSuccess } from "@/lib/toast";

export function useResendOrderToDistribution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => api.orders.distributionResend(orderId),
    onSuccess: async () => {
      toastSuccess("تمت إعادة التوزيع");
      await invalidateOrderDistributionDomain(qc);
    },
    onError: (e) => toastApiError(e, "تعذرت إعادة التوزيع"),
  });
}
