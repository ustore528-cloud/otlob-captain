import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import { api } from "@/lib/api/singleton";
import { toastApiError, toastSuccess } from "@/lib/toast";

export function useStartOrderAutoDistribution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => api.orders.distributionAuto(orderId),
    onSuccess: async () => {
      toastSuccess("تم بدء التوزيع التلقائي");
      await qc.invalidateQueries({ queryKey: queryKeys.orders.root });
      await qc.invalidateQueries({ queryKey: queryKeys.dashboard.root });
    },
    onError: (e) => toastApiError(e, "تعذر بدء التوزيع"),
  });
}
