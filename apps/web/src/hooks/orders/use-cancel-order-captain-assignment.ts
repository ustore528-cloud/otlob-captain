import { useMutation, useQueryClient } from "@tanstack/react-query";
import i18n from "@/i18n/i18n";
import { invalidateOrderDistributionDomain } from "@/lib/invalidate-order-domain";
import { api } from "@/lib/api/singleton";
import { toastApiError, toastSuccess } from "@/lib/toast";

export function useCancelOrderCaptainAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => api.orders.distributionCancelCaptain(orderId),
    onSuccess: async () => {
      toastSuccess(String(i18n.t("mutationToasts.cancelCaptainSuccess")));
      await invalidateOrderDistributionDomain(qc);
    },
    onError: (e) => toastApiError(e, String(i18n.t("mutationToasts.cancelCaptainFailed"))),
  });
}
