import { useCallback, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { ChefHat, MapPinned, Users } from "lucide-react";
import { useAssignOrderToCaptain, useCaptainLocations, useCaptains, useOrders, useResendOrderToDistribution } from "@/hooks";
import { ManualAssignModal } from "@/features/shared/manual-assign-modal";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { CaptainQuickDropPanel } from "@/features/distribution/components/captain-quick-drop-panel";
import { ASSIGNED_LIST_PARAMS, CONFIRMED_LIST_PARAMS, PENDING_LIST_PARAMS } from "@/features/distribution/constants";
import { DistributionMap } from "@/features/distribution/distribution-map";
import { DraggableOrderCard } from "@/features/distribution/draggable-order-card";
import { useAuthStore } from "@/stores/auth-store";
import type { OrderListItem } from "@/types/api";

function useDispatchRole() {
  const role = useAuthStore((s) => s.user?.role);
  return role === "ADMIN" || role === "DISPATCHER";
}

export function DistributionPageView() {
  const token = useAuthStore((s) => s.token);
  const canDispatch = useDispatchRole();
  const [dragOrderId, setDragOrderId] = useState<string | null>(null);
  const [manualOrder, setManualOrder] = useState<OrderListItem | null>(null);

  /** تحديث دوري لرؤية انتقال عرض الطلب (الإطار الأصفر) بين الكباتن على الخريطة دون إعادة تحميل الصفحة */
  const distributionPollMs = 4000;

  const pendingQ = useOrders(PENDING_LIST_PARAMS, {
    enabled: Boolean(token) && canDispatch,
    refetchInterval: distributionPollMs,
  });
  const confirmedQ = useOrders(CONFIRMED_LIST_PARAMS, {
    enabled: Boolean(token) && canDispatch,
    refetchInterval: distributionPollMs,
  });
  const assignedQ = useOrders(ASSIGNED_LIST_PARAMS, {
    enabled: Boolean(token) && canDispatch,
    refetchInterval: distributionPollMs,
  });
  const { activeMap: mapCaptains } = useCaptainLocations({
    enabledLatest: false,
    activeMapRefetchInterval: distributionPollMs,
  });

  const statsPending = useOrders(
    { page: 1, pageSize: 1, status: "PENDING", orderNumber: "", customerPhone: "" },
    { enabled: Boolean(token) && canDispatch },
  );
  const statsConfirmed = useOrders(
    { page: 1, pageSize: 1, status: "CONFIRMED", orderNumber: "", customerPhone: "" },
    { enabled: Boolean(token) && canDispatch },
  );
  const statsCaptains = useCaptains({ page: 1, pageSize: 1, isActive: true }, { enabled: Boolean(token) && canDispatch });

  const captainPool = useCaptains({ page: 1, pageSize: 100 }, { enabled: Boolean(token) && canDispatch });

  const mergedOrders = useMemo(() => {
    const a = pendingQ.data?.items ?? [];
    const b = confirmedQ.data?.items ?? [];
    const c = assignedQ.data?.items ?? [];
    return [...c, ...a, ...b].sort((x, y) => (x.createdAt < y.createdAt ? 1 : -1));
  }, [assignedQ.data?.items, pendingQ.data?.items, confirmedQ.data?.items]);

  const resend = useResendOrderToDistribution();
  const assign = useAssignOrderToCaptain();

  const onAssignDrop = useCallback(
    (orderId: string, captainId: string) => {
      assign.mutate({ orderId, captainId, mode: "drag-drop" });
    },
    [assign],
  );

  if (!token) return null;
  if (!canDispatch) return <Navigate to="/" replace />;

  const activeCaptainsTotal = statsCaptains.data?.total ?? "—";
  const pendingTotal = statsPending.data?.total ?? "—";
  const confirmedTotal = statsConfirmed.data?.total ?? "—";

  return (
    <div className="grid gap-8">
      <PageHeader
        title="التوزيع"
        description="الطلبات قيد التوزيع بجانب الخريطة؛ اسحب البطاقة إلى الخريطة أو إلى اسم الكابتن."
      />

      {/* عمود الخريطة + شريط الطلبات (قيد التوزيع) — اتجاه ltr ليظهر الشريط يمين الخريطة */}
      <section className="grid gap-4 [direction:ltr] lg:grid-cols-[minmax(0,1fr)_minmax(280px,400px)] lg:items-stretch">
        <div className="min-w-0 [direction:rtl]">
          <DistributionMap captains={mapCaptains.data ?? []} onAssignDrop={onAssignDrop} draggingOrderId={dragOrderId} />
        </div>

        <aside className="flex max-h-[min(92vh,900px)] min-h-0 flex-col overflow-hidden rounded-2xl border border-card-border bg-card shadow-sm [direction:rtl] lg:sticky lg:top-6 lg:max-h-[calc(100vh-8rem)]">
          <div className="shrink-0 border-b border-card-border bg-card px-4 py-3">
            <h2 className="text-base font-semibold">الطلبات قيد التوزيع</h2>
            <p className="mt-1 text-xs text-muted">
              بانتظار التوزيع، التجهيز، أو بانتظار رد الكابتن — اسحب البطاقة نحو الخريطة أو أسماء الكباتن أدناه
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 pe-2">
            {pendingQ.isLoading || confirmedQ.isLoading || assignedQ.isLoading ? (
              <p className="text-sm text-muted">جارٍ التحميل…</p>
            ) : mergedOrders.length === 0 ? (
              <p className="text-sm text-muted">لا توجد طلبات قيد التوزيع حالياً.</p>
            ) : (
              <div className="grid gap-3">
                {mergedOrders.map((o) => (
                  <DraggableOrderCard
                    key={o.id}
                    order={o}
                    onDragState={setDragOrderId}
                    onManual={setManualOrder}
                    onResend={(ord) => resend.mutate(ord.id)}
                    busy={resend.isPending || assign.isPending}
                  />
                ))}
              </div>
            )}
          </div>
        </aside>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="كباتن نشطون" value={activeCaptainsTotal} hint="isActive = true" icon={Users} />
        <StatCard label="بانتظار التوزيع" value={pendingTotal} hint="حالة PENDING" icon={MapPinned} />
        <StatCard label="طلبات التجهيز" value={confirmedTotal} hint="حالة CONFIRMED" icon={ChefHat} />
      </div>

      <section className="grid gap-3 [direction:rtl]">
        <h2 className="text-base font-semibold">الكباتن (إسقاط بالاسم)</h2>
        <CaptainQuickDropPanel captains={mapCaptains.data ?? []} onDropOrderOnCaptain={onAssignDrop} />
      </section>

      <ManualAssignModal
        open={Boolean(manualOrder)}
        onClose={() => setManualOrder(null)}
        orderLabel={manualOrder?.orderNumber ?? ""}
        captains={captainPool.data?.items ?? []}
        isPending={assign.isPending}
        onSubmit={(captainId) => {
          if (manualOrder)
            assign.mutate(
              { orderId: manualOrder.id, captainId, mode: "manual" },
              { onSuccess: () => setManualOrder(null) },
            );
        }}
      />

      {(pendingQ.isError || confirmedQ.isError || assignedQ.isError || mapCaptains.isError) && (
        <p className="text-sm text-red-600">
          {(pendingQ.error as Error)?.message ??
            (confirmedQ.error as Error)?.message ??
            (assignedQ.error as Error)?.message ??
            (mapCaptains.error as Error)?.message}
        </p>
      )}
    </div>
  );
}
