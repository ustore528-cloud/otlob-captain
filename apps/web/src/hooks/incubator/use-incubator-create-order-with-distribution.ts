import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateOrderPayload } from "@/lib/api/services/orders";
import { invalidateOrderDistributionDomain } from "@/lib/invalidate-order-domain";
import { api } from "@/lib/api/singleton";
import { toastApiError, toastSuccess } from "@/lib/toast";

/**
 * إنشاء طلب ثم استدعاء نفس مسار «توزيع تلقائي» في قائمة الطلبات — دون تغيير منطق الإنشاء العام.
 */
export function useIncubatorCreateOrderWithDistribution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateOrderPayload) => {
      const order = await api.orders.create(body);
      try {
        await api.orders.distributionAuto(order.id);
        return { order, distributionStarted: true as const };
      } catch (e) {
        return { order, distributionStarted: false as const, distributionError: e };
      }
    },
    onSuccess: async (result) => {
      if (result.distributionStarted) {
        toastSuccess(`تم إنشاء الطلب ${result.order.orderNumber} وبدء التوزيع التلقائي.`);
      } else {
        toastSuccess(`تم إنشاء الطلب ${result.order.orderNumber}.`);
        toastApiError(
          result.distributionError,
          "تعذر بدء التوزيع التلقائي تلقائياً — افتح قائمة الطلبات واضغط «توزيع تلقائي» لهذا الطلب.",
        );
      }
      await invalidateOrderDistributionDomain(qc);
    },
    onError: (e) => toastApiError(e, "تعذر إنشاء الطلب"),
  });
}
