import { useMutation, useQueryClient } from "@tanstack/react-query";
import i18n from "@/i18n/i18n";
import { queryKeys } from "@/lib/api/query-keys";
import { api } from "@/lib/api/singleton";
import { toastApiError, toastSuccess } from "@/lib/toast";

export type QuickStatusCode = "PRESSURE" | "LOW_ACTIVITY" | "RAISE_READINESS" | "ON_FIRE";

export function useSendQuickStatusAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: QuickStatusCode) => api.notifications.quickStatus(status),
    onSuccess: async (_, status) => {
      const label = String(i18n.t(`dashboard.quickStatus.${status}`));
      toastSuccess(String(i18n.t("mutationToasts.quickAlertSent", { label })));
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.notifications.root }),
        qc.invalidateQueries({ queryKey: queryKeys.activity.root }),
      ]);
    },
    onError: (e) => toastApiError(e, String(i18n.t("mutationToasts.quickAlertFailed"))),
  });
}
