import { useMutation, useQueryClient } from "@tanstack/react-query";
import i18n from "@/i18n/i18n";
import { queryKeys } from "@/lib/api/query-keys";
import { api } from "@/lib/api/singleton";
import { toastApiError, toastSuccess } from "@/lib/toast";

export function useDeleteCaptain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.captains.delete(id),
    onSuccess: async () => {
      toastSuccess(String(i18n.t("mutationToasts.captainDeleted")));
      await qc.invalidateQueries({ queryKey: queryKeys.captains.root });
      await qc.invalidateQueries({ queryKey: queryKeys.users.root });
      await qc.invalidateQueries({ queryKey: queryKeys.orders.root });
      await qc.invalidateQueries({ queryKey: queryKeys.tracking.root });
      await qc.invalidateQueries({ queryKey: queryKeys.dashboard.root });
    },
    onError: (e) => toastApiError(e, String(i18n.t("mutationToasts.captainDeleteFailed"))),
  });
}
