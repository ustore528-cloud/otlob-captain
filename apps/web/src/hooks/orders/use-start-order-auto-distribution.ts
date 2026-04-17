import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateOrderDistributionDomain } from "@/lib/invalidate-order-domain";
import { api } from "@/lib/api/singleton";
import { toastApiError, toastSuccess } from "@/lib/toast";

export function useStartOrderAutoDistribution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => api.orders.distributionAuto(orderId),
    onSuccess: async () => {
      toastSuccess("تم بدء التوزيع التلقائي");
      await invalidateOrderDistributionDomain(qc);
    },
    onError: (e) => toastApiError(e, "تعذر بدء التوزيع"),
  });
}
