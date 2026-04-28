import { useMutation, useQueryClient } from "@tanstack/react-query";
import i18n from "@/i18n/i18n";
import { queryKeys } from "@/lib/api/query-keys";
import type { CreateCaptainPayload } from "@/lib/api/services/captains";
import { api } from "@/lib/api/singleton";
import { toastApiError, toastSuccess } from "@/lib/toast";

export function useCreateCaptain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCaptainPayload) => api.captains.create(body),
    onSuccess: async () => {
      toastSuccess(String(i18n.t("mutationToasts.captainCreated")));
      await qc.invalidateQueries({ queryKey: queryKeys.captains.root });
      await qc.invalidateQueries({ queryKey: queryKeys.users.root });
      await qc.invalidateQueries({ queryKey: queryKeys.dashboard.root });
      await qc.invalidateQueries({ queryKey: queryKeys.zones.root });
      await qc.invalidateQueries({ queryKey: queryKeys.tracking.root });
      await qc.invalidateQueries({ queryKey: queryKeys.companies.root });
    },
    onError: (e) => toastApiError(e, String(i18n.t("mutationToasts.captainCreateFailed"))),
  });
}
