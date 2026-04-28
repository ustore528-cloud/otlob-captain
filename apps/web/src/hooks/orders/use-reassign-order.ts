import { useMutation, useQueryClient } from "@tanstack/react-query";
import i18n from "@/i18n/i18n";
import { invalidateOrderDistributionDomain } from "@/lib/invalidate-order-domain";
import { api } from "@/lib/api/singleton";
import { toastApiError, toastSuccess } from "@/lib/toast";

type ReassignVariables = {
  orderId: string;
  captainId: string;
};

export function useReassignOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, captainId }: ReassignVariables) => api.orders.distributionReassign(orderId, captainId),
    onSuccess: async () => {
      toastSuccess(String(i18n.t("mutationToasts.orderReassigned")));
      await invalidateOrderDistributionDomain(qc);
    },
    onError: (e) => toastApiError(e, String(i18n.t("mutationToasts.orderReassignFailed"))),
  });
}
