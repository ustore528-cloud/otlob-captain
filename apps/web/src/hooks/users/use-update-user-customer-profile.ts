import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import { api } from "@/lib/api/singleton";
import type { UpdateCustomerProfilePayload } from "@/lib/api/services/users";
import { toastApiError, toastSuccess } from "@/lib/toast";

export function useUpdateUserCustomerProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateCustomerProfilePayload }) =>
      api.users.updateCustomerProfile(id, body),
    onSuccess: async () => {
      toastSuccess("تم حفظ بيانات العميل");
      await qc.invalidateQueries({ queryKey: queryKeys.users.root });
    },
    onError: (e) => toastApiError(e, "تعذر حفظ بيانات العميل"),
  });
}
