import { useCallback, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { ChefHat, MapPinned, Users } from "lucide-react";
import { useAssignOrderToCaptain, useCaptainLocations, useCaptains, useOrders, useResendOrderToDistribution } from "@/hooks";
import { ManualAssignModal } from "@/components/manual-assign-modal";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { DistributionMap } from "@/features/distribution/distribution-map";
import { DraggableOrderCard } from "@/features/distribution/draggable-order-card";
import { useAuthStore } from "@/stores/auth-store";
import type { OrderListItem } from "@/types/api";

function useDispatchRole() {
  const role = useAuthStore((s) => s.user?.role);
  return role === "ADMIN" || role === "DISPATCHER";
}

const PENDING_PARAMS = { page: 1, pageSize: 80, status: "PENDING", orderNumber: "", customerPhone: "" };
const CONFIRMED_PARAMS = { page: 1, pageSize: 80, status: "CONFIRMED", orderNumber: "", customerPhone: "" };

export function DistributionPage() {
  const token = useAuthStore((s) => s.token);
  const canDispatch = useDispatchRole();
  const [dragOrderId, setDragOrderId] = useState<string | null>(null);
  const [manualOrder, setManualOrder] = useState<OrderListItem | null>(null);

  const pendingQ = useOrders(PENDING_PARAMS, { enabled: Boolean(token) && canDispatch });
  const confirmedQ = useOrders(CONFIRMED_PARAMS, { enabled: Boolean(token) && canDispatch });
  const { activeMap: mapCaptains } = useCaptainLocations({ enabledLatest: false });

  const statsPending = useOrders({ page: 1, pageSize: 1, status: "PENDING", orderNumber: "", customerPhone: "" }, {
    enabled: Boolean(token) && canDispatch,
  });
  const statsConfirmed = useOrders(
    { page: 1, pageSize: 1, status: "CONFIRMED", orderNumber: "", customerPhone: "" },
    { enabled: Boolean(token) && canDispatch },
  );
  const statsCaptains = useCaptains({ page: 1, pageSize: 1, isActive: true }, { enabled: Boolean(token) && canDispatch });

  const captainPool = useCaptains({ page: 1, pageSize: 200 }, { enabled: Boolean(token) && canDispatch });

  const mergedOrders = useMemo(() => {
    const a = pendingQ.data?.items ?? [];
    const b = confirmedQ.data?.items ?? [];
    return [...a, ...b].sort((x, y) => (x.createdAt < y.createdAt ? 1 : -1));
  }, [pendingQ.data?.items, confirmedQ.data?.items]);

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
        description="متابعة الطلبات بانتظار التوزيع، إعادة الإرسال، والتعيين اليدوي مع خريطة حية للكباتن."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="كباتن نشطون" value={activeCaptainsTotal} hint="isActive = true" icon={Users} />
        <StatCard label="بانتظار التوزيع" value={pendingTotal} hint="حالة PENDING" icon={MapPinned} />
        <StatCard label="طلبات التجهيز" value={confirmedTotal} hint="حالة CONFIRMED" icon={ChefHat} />
      </div>

      <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-3">
          <h2 className="text-base font-semibold">قائمة الطلبات</h2>
          {pendingQ.isLoading || confirmedQ.isLoading ? (
            <p className="text-sm text-muted">جارٍ التحميل…</p>
          ) : mergedOrders.length === 0 ? (
            <p className="text-sm text-muted">لا توجد طلبات في انتظار التوزيع أو التجهيز.</p>
          ) : (
            mergedOrders.map((o) => (
              <DraggableOrderCard
                key={o.id}
                order={o}
                onDragState={setDragOrderId}
                onManual={setManualOrder}
                onResend={(ord) => resend.mutate(ord.id)}
                busy={resend.isPending || assign.isPending}
              />
            ))
          )}
        </div>

        <div className="grid gap-2 rounded-2xl border border-card-border bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold">إفلات سريع — الكباتن</h3>
          <p className="text-xs text-muted">يمكنك أيضًا الإفلات على الخريطة.</p>
          <div className="mt-2 grid max-h-[420px] gap-2 overflow-y-auto pe-1">
            {(mapCaptains.data ?? []).map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-dashed border-card-border bg-background/40 px-3 py-2 text-sm transition hover:border-primary/40"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "copy";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const orderId = e.dataTransfer.getData("application/x-order-id") || e.dataTransfer.getData("text/plain");
                  if (orderId) assign.mutate({ orderId, captainId: c.id, mode: "drag-drop" });
                }}
              >
                <div className="font-medium">{c.user.fullName}</div>
                <div className="text-xs text-muted" dir="ltr">
                  {c.user.phone}
                </div>
                <div className="mt-1 text-[11px] text-muted">{c.availabilityStatus}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <DistributionMap captains={mapCaptains.data ?? []} onAssignDrop={onAssignDrop} draggingOrderId={dragOrderId} />

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

      {(pendingQ.isError || confirmedQ.isError || mapCaptains.isError) && (
        <p className="text-sm text-red-600">
          {(pendingQ.error as Error)?.message ??
            (confirmedQ.error as Error)?.message ??
            (mapCaptains.error as Error)?.message}
        </p>
      )}
    </div>
  );
}
