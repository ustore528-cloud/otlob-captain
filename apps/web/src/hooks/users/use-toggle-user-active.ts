import { useMutation, useQueryClient } from "@tanstack/react-query";
import i18n from "@/i18n/i18n";
import { queryKeys } from "@/lib/api/query-keys";
import { api } from "@/lib/api/singleton";
import { toastApiError, toastSuccess } from "@/lib/toast";

export function useToggleUserActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.users.setActive(id, isActive),
    onSuccess: async (_, v) => {
      toastSuccess(
        String(i18n.t(v.isActive ? "mutationToasts.userToggledOn" : "mutationToasts.userToggledOff")),
      );
      await qc.invalidateQueries({ queryKey: queryKeys.users.root });
    },
    onError: (e) => toastApiError(e, String(i18n.t("mutationToasts.userToggleFailed"))),
  });
}
