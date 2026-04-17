import { useMemo, useState } from "react";
import { Radio } from "lucide-react";
import {
  useAssignOrderToCaptain,
  useCancelOrderCaptainAssignment,
  useCaptains,
  useOrders,
  useResendOrderToDistribution,
  useStartOrderAutoDistribution,
} from "@/hooks";
import { ManualAssignModal } from "@/features/shared/manual-assign-modal";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { OrdersListSection } from "@/features/orders/components/orders-list-section";
import { ORDERS_PAGE_INITIAL_LIST_PARAMS } from "@/router/loaders";
import { useAuthStore } from "@/stores/auth-store";
import type { OrderListItem } from "@/types/api";

export function OrdersPageView() {
  const role = useAuthStore((s) => s.user?.role);
  const [status, setStatus] = useState(ORDERS_PAGE_INITIAL_LIST_PARAMS.status);
  const [q, setQ] = useState("");
  const [manualOrder, setManualOrder] = useState<OrderListItem | null>(null);

  const canDispatch = role === "ADMIN" || role === "DISPATCHER";

  const orderParams = useMemo(() => {
    const t = q.trim();
    const phoneLike = /^[\d+\s()-]{5,}$/.test(t);
    return {
      page: 1,
      pageSize: 50,
      status,
      customerPhone: phoneLike ? t : "",
      orderNumber: phoneLike ? "" : t,
    };
  }, [status, q]);

  const orders = useOrders(orderParams);
  const captains = useCaptains(
    { page: 1, pageSize: 100 },
    { enabled: Boolean(manualOrder) && canDispatch },
  );

  const auto = useStartOrderAutoDistribution();
  const resend = useResendOrderToDistribution();
  const cancelCaptain = useCancelOrderCaptainAssignment();
  const assign = useAssignOrderToCaptain();

  const rows = orders.data?.items ?? [];

  const filterNote = useMemo(() => {
    if (!q.trim()) return null;
    return /^[\d+\s()-]{5,}$/.test(q.trim())
      ? "يبحث في هاتف العميل."
      : "يبحث في رقم الطلب (نص جزئي).";
  }, [q]);

  return (
    <div className="grid gap-8">
      <PageHeader
        title="الطلبات"
        description="بحث وتصفية، تعيين يدوي، وإعادة التوزيع للصلاحيات المخولة."
        actions={
          <Button type="button" variant="secondary" onClick={() => void orders.refetch()} disabled={orders.isFetching}>
            <Radio className="opacity-80" />
            تحديث
          </Button>
        }
      />

      <OrdersListSection
        search={q}
        onSearchChange={setQ}
        status={status}
        onStatusChange={setStatus}
        filterNote={filterNote}
        loading={orders.isLoading}
        error={orders.isError ? (orders.error as Error) : null}
        rows={rows}
        canDispatch={canDispatch}
        onAuto={(id) => auto.mutate(id)}
        onManual={setManualOrder}
        onResend={(id) => resend.mutate(id)}
        onCancelCaptain={(id) => cancelCaptain.mutate(id)}
        autoPending={auto.isPending}
        resendPending={resend.isPending}
        cancelPending={cancelCaptain.isPending}
      />

      <ManualAssignModal
        open={Boolean(manualOrder)}
        onClose={() => setManualOrder(null)}
        orderLabel={manualOrder?.orderNumber ?? ""}
        captains={captains.data?.items ?? []}
        isPending={assign.isPending}
        onSubmit={(captainId) => {
          if (manualOrder)
            assign.mutate(
              { orderId: manualOrder.id, captainId, mode: "manual" },
              { onSuccess: () => setManualOrder(null) },
            );
        }}
      />
    </div>
  );
}
