import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import type { CreateCaptainPayload } from "@/lib/api/services/captains";
import { api } from "@/lib/api/singleton";
import { toastApiError, toastSuccess } from "@/lib/toast";

export function useCreateCaptain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCaptainPayload) => api.captains.create(body),
    onSuccess: async () => {
      toastSuccess("تم إنشاء الكابتن");
      await qc.invalidateQueries({ queryKey: queryKeys.captains.root });
    },
    onError: (e) => toastApiError(e, "تعذر إنشاء الكابتن"),
  });
}
