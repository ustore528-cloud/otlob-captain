import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import type { UpdateCaptainPayload } from "@/lib/api/services/captains";
import { api } from "@/lib/api/singleton";
import { toastApiError, toastSuccess } from "@/lib/toast";

export function useUpdateCaptain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateCaptainPayload }) => api.captains.update(id, body),
    onSuccess: async () => {
      toastSuccess("تم تحديث بيانات الكابتن");
      await qc.invalidateQueries({ queryKey: queryKeys.captains.root });
      await qc.invalidateQueries({ queryKey: queryKeys.users.root });
      await qc.invalidateQueries({ queryKey: queryKeys.tracking.root });
    },
    onError: (e) => toastApiError(e, "تعذر تحديث الكابتن"),
  });
}
