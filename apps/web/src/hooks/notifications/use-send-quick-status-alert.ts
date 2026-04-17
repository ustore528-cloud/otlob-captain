import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import { api } from "@/lib/api/singleton";
import { toastApiError, toastSuccess } from "@/lib/toast";

export type QuickStatusCode = "PRESSURE" | "LOW_ACTIVITY" | "RAISE_READINESS" | "ON_FIRE";

const STATUS_LABEL: Record<QuickStatusCode, string> = {
  PRESSURE: "ضغط",
  LOW_ACTIVITY: "حركة ضعيفة",
  RAISE_READINESS: "ارفع الجاهزية",
  ON_FIRE: "الوضع نار",
};

export function useSendQuickStatusAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: QuickStatusCode) => api.notifications.quickStatus(status),
    onSuccess: async (_, status) => {
      toastSuccess(`تم إرسال تنبيه: ${STATUS_LABEL[status]}`);
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.notifications.root }),
        qc.invalidateQueries({ queryKey: queryKeys.activity.root }),
      ]);
    },
    onError: (e) => toastApiError(e, "تعذر إرسال التنبيه السريع"),
  });
}
