import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
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
      await qc.invalidateQueries({ queryKey: queryKeys.orders.root });
      await qc.invalidateQueries({ queryKey: queryKeys.dashboard.root });
    },
    onError: (e) => toastApiError(e, "تعذر تعيين الكابتن"),
  });
}
