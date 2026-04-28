import { useMutation, useQueryClient } from "@tanstack/react-query";
import i18n from "@/i18n/i18n";
import type { CreateOrderPayload } from "@/lib/api/services/orders";
import { invalidateOrderDistributionDomain } from "@/lib/invalidate-order-domain";
import { api } from "@/lib/api/singleton";
import { toastApiError, toastSuccess } from "@/lib/toast";

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
        toastSuccess(String(i18n.t("mutationToasts.orderCreatedWithDist", { number: result.order.orderNumber })));
      } else {
        toastSuccess(String(i18n.t("mutationToasts.orderCreatedNoDist", { number: result.order.orderNumber })));
        toastApiError(result.distributionError, String(i18n.t("mutationToasts.autoDistFailed")));
      }
      await invalidateOrderDistributionDomain(qc);
    },
    onError: (e) => toastApiError(e, String(i18n.t("mutationToasts.incubatorCreateFailed"))),
  });
}
