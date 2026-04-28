import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/singleton";
import { invalidateOrderDistributionDomain } from "@/lib/invalidate-order-domain";
import { toastApiError, toastSuccess } from "@/lib/toast";

type Props = {
  orderIds: string[];
  zoneId?: string;
  disabled?: boolean;
};

export function AutoDistributeButton({ orderIds, zoneId, disabled }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => api.orders.distributionAutoAssignVisible({ orderIds, zoneId }),
    onSuccess: async (data) => {
      toastSuccess(t("distribution.auto.successTitle"));
      toastSuccess(t("distribution.auto.successDetail", { assigned: data.assignedCount, skipped: data.skippedCount }));
      await invalidateOrderDistributionDomain(qc);
    },
    onError: (error) => toastApiError(error, t("distribution.auto.error")),
  });

  return (
    <div className="space-y-2">
      <Button
        type="button"
        className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
        disabled={disabled || mutation.isPending || orderIds.length === 0}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? t("distribution.auto.pending") : t("distribution.auto.button")}
      </Button>
      <p className="text-xs text-muted">{t("distribution.auto.hint")}</p>
    </div>
  );
}
