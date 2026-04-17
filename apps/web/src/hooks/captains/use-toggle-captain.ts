import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import type { CaptainListItem, Paginated } from "@/types/api";
import { api } from "@/lib/api/singleton";
import { toastApiError, toastSuccess } from "@/lib/toast";

export function useToggleCaptain() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.captains.setActive(id, isActive),
    onMutate: async ({ id, isActive }) => {
      await qc.cancelQueries({ queryKey: queryKeys.captains.root });
      const previous = qc.getQueriesData<Paginated<CaptainListItem>>({ queryKey: ["captains", "list"] });
      previous.forEach(([key, data]) => {
        if (!data) return;
        qc.setQueryData<Paginated<CaptainListItem>>(key, {
          ...data,
          items: data.items.map((c) => (c.id === id ? { ...c, isActive } : c)),
        });
      });
      return { previous };
    },
    onError: (err, _v, ctx) => {
      ctx?.previous.forEach(([key, data]) => qc.setQueryData(key, data));
      toastApiError(err, "تعذر تحديث حالة الكابتن");
    },
    onSuccess: async (_d, v) => {
      toastSuccess(v.isActive ? "تم التفعيل" : "تم التعطيل");
      await qc.invalidateQueries({ queryKey: queryKeys.captains.root });
      await qc.invalidateQueries({ queryKey: queryKeys.tracking.root });
      await qc.invalidateQueries({ queryKey: queryKeys.dashboard.root });
    },
  });
}
