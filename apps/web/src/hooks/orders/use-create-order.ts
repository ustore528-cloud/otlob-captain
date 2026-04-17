import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateOrderPayload } from "@/lib/api/services/orders";
import { invalidateOrderDistributionDomain } from "@/lib/invalidate-order-domain";
import { api } from "@/lib/api/singleton";
import { toastApiError, toastSuccess } from "@/lib/toast";

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateOrderPayload) => api.orders.create(body),
    onSuccess: async () => {
      toastSuccess("تم إنشاء الطلب");
      await invalidateOrderDistributionDomain(qc);
    },
    onError: (e) => toastApiError(e, "تعذر إنشاء الطلب"),
  });
}
