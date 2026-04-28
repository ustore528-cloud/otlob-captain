import { useMutation, useQueryClient } from "@tanstack/react-query";
import i18n from "@/i18n/i18n";
import type { CreateUserPayload } from "@/lib/api/services/users";
import { queryKeys } from "@/lib/api/query-keys";
import { api } from "@/lib/api/singleton";
import { toastApiError, toastSuccess } from "@/lib/toast";

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateUserPayload) => api.users.create(body),
    onSuccess: async () => {
      toastSuccess(String(i18n.t("mutationToasts.userCreated")));
      await qc.invalidateQueries({ queryKey: queryKeys.users.root });
    },
    onError: (e) => toastApiError(e, String(i18n.t("mutationToasts.userCreateFailed"))),
  });
}
