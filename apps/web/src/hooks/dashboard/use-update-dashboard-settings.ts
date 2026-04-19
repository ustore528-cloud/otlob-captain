import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import { api } from "@/lib/api/singleton";
import type { DashboardSettingsPatchPayload } from "@/lib/api/services/dashboard-settings";

export function useUpdateDashboardSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: DashboardSettingsPatchPayload) => api.dashboardSettings.patch(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard.settings() });
    },
  });
}
