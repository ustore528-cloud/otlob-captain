import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import type { CreateOrderPayload } from "@/lib/api/services/orders";
import { api } from "@/lib/api/singleton";
import { toastApiError, toastSuccess } from "@/lib/toast";

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateOrderPayload) => api.orders.create(body),
    onSuccess: async () => {
      toastSuccess("تم إنشاء الطلب");
      await qc.invalidateQueries({ queryKey: queryKeys.orders.root });
      await qc.invalidateQueries({ queryKey: queryKeys.dashboard.root });
    },
    onError: (e) => toastApiError(e, "تعذر إنشاء الطلب"),
  });
}
