import { useMutation, useQueryClient } from "@tanstack/react-query";
import i18n from "@/i18n/i18n";
import { invalidateOrderDistributionDomain } from "@/lib/invalidate-order-domain";
import { api } from "@/lib/api/singleton";
import { toastApiError, toastSuccess } from "@/lib/toast";
import type { OrderStatus } from "@/types/api";

export type AdminOverrideTargetStatus = Extract<OrderStatus, "PENDING" | "CONFIRMED" | "CANCELLED" | "DELIVERED">;

export const ADMIN_OVERRIDE_TARGET_STATUSES: AdminOverrideTargetStatus[] = [
  "PENDING",
  "CONFIRMED",
  "CANCELLED",
  "DELIVERED",
];

export function useAdminOverrideOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { orderId: string; status: AdminOverrideTargetStatus }) =>
      api.orders.adminOverrideStatus(vars.orderId, vars.status),
    onSuccess: async () => {
      toastSuccess(String(i18n.t("mutationToasts.adminStatusOk")));
      await invalidateOrderDistributionDomain(qc);
    },
    onError: (e) => toastApiError(e, String(i18n.t("mutationToasts.adminStatusFailed"))),
  });
}
