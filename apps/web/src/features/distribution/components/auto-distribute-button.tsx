import { useMutation, useQueryClient } from "@tanstack/react-query";
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
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => api.orders.distributionAutoAssignVisible({ orderIds, zoneId }),
    onSuccess: async (data) => {
      toastSuccess("تم التوزيع التلقائي");
      toastSuccess(`تم توزيع ${data.assignedCount} طلب، وتخطي ${data.skippedCount} طلب.`);
      await invalidateOrderDistributionDomain(qc);
    },
    onError: (error) => toastApiError(error, "تعذر تنفيذ التوزيع التلقائي"),
  });

  return (
    <div className="space-y-2">
      <Button
        type="button"
        className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
        disabled={disabled || mutation.isPending || orderIds.length === 0}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? "جاري التوزيع..." : "توزيع تلقائي"}
      </Button>
      <p className="text-xs text-muted">يوزّع كل الطلبات المعروضة على الكباتن المناسبين</p>
    </div>
  );
}
