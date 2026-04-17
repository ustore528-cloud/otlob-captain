import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateOrderDistributionDomain } from "@/lib/invalidate-order-domain";
import { api } from "@/lib/api/singleton";
import { toastApiError, toastSuccess } from "@/lib/toast";

export type AssignOrderMode = "manual" | "drag-drop";

export type AssignOrderToCaptainVariables = {
  orderId: string;
  captainId: string;
  mode: AssignOrderMode;
};

export function useAssignOrderToCaptain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, captainId, mode }: AssignOrderToCaptainVariables) =>
      mode === "drag-drop"
        ? api.orders.distributionDragDrop(orderId, captainId)
        : api.orders.distributionManual(orderId, captainId),
    onSuccess: async (_, v) => {
      toastSuccess(v.mode === "drag-drop" ? "تم التعيين (سحب وإفلات)" : "تم التعيين اليدوي");
      await invalidateOrderDistributionDomain(qc);
    },
    onError: (e) => toastApiError(e, "تعذر تعيين الكابتن"),
  });
}
