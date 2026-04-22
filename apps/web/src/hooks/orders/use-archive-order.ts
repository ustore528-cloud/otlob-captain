import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateOrderDistributionDomain } from "@/lib/invalidate-order-domain";
import { api } from "@/lib/api/singleton";
import { toastApiError, toastSuccess } from "@/lib/toast";

export function useArchiveOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => api.orders.archive(orderId),
    onSuccess: async () => {
      toastSuccess("تمت إزالة الطلب من القائمة التشغيلية — السجل محفوظ في قاعدة البيانات.");
      await invalidateOrderDistributionDomain(qc);
    },
    onError: (e) => toastApiError(e, "تعذّر أرشفة الطلب"),
  });
}
