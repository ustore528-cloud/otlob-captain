import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import { api } from "@/lib/api/singleton";
import { toastApiError, toastSuccess } from "@/lib/toast";

export function useDeleteCaptain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.captains.delete(id),
    onSuccess: async () => {
      toastSuccess("تم حذف الكابتن وحسابه");
      await qc.invalidateQueries({ queryKey: queryKeys.captains.root });
      await qc.invalidateQueries({ queryKey: queryKeys.users.root });
      await qc.invalidateQueries({ queryKey: queryKeys.orders.root });
      await qc.invalidateQueries({ queryKey: queryKeys.tracking.root });
      await qc.invalidateQueries({ queryKey: queryKeys.dashboard.root });
    },
    onError: (e) => toastApiError(e, "تعذر حذف الكابتن"),
  });
}
