import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import { api } from "@/lib/api/singleton";
import { toastApiError, toastSuccess } from "@/lib/toast";

export function useToggleUserActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.users.setActive(id, isActive),
    onSuccess: async (_, v) => {
      toastSuccess(v.isActive ? "تم تفعيل المستخدم" : "تم تعطيل المستخدم");
      await qc.invalidateQueries({ queryKey: queryKeys.users.root });
    },
    onError: (e) => toastApiError(e, "تعذر تحديث المستخدم"),
  });
}
