import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import { api } from "@/lib/api/singleton";
import { toastApiError, toastSuccess } from "@/lib/toast";

export function useResendOrderToDistribution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => api.orders.distributionResend(orderId),
    onSuccess: async () => {
      toastSuccess("تمت إعادة التوزيع");
      await qc.invalidateQueries({ queryKey: queryKeys.orders.root });
      await qc.invalidateQueries({ queryKey: queryKeys.dashboard.root });
    },
    onError: (e) => toastApiError(e, "تعذرت إعادة التوزيع"),
  });
}
