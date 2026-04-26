import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import type { UpdateStorePayload } from "@/lib/api/services/stores";
import { api } from "@/lib/api/singleton";
import { toastApiError, toastSuccess } from "@/lib/toast";

export function useUpdateStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateStorePayload }) => api.stores.update(id, body),
    onSuccess: async () => {
      toastSuccess("تم تحديث بيانات المتجر");
      await qc.invalidateQueries({ queryKey: queryKeys.stores.root });
      await qc.invalidateQueries({ queryKey: queryKeys.orders.root });
    },
    onError: (e) => toastApiError(e, "تعذر تحديث بيانات المتجر"),
  });
}
