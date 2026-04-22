import { useCallback, useMemo, useState } from "react";
import { resolveDashboardMapView } from "@/features/distribution/map-default-view";
import { Navigate } from "react-router-dom";
import { ChefHat, MapPinned, Users } from "lucide-react";
import {
  useAssignOrderToCaptain,
  useCaptainLocations,
  useCaptains,
  useDashboardSettings,
  useOrders,
  useResendOrderToDistribution,
} from "@/hooks";
import { ManualAssignModal } from "@/features/shared/manual-assign-modal";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { CaptainQuickDropPanel } from "@/features/distribution/components/captain-quick-drop-panel";
import { ASSIGNED_LIST_PARAMS, CONFIRMED_LIST_PARAMS, PENDING_LIST_PARAMS } from "@/features/distribution/constants";
import { DistributionMap } from "@/features/distribution/distribution-map";
import { DraggableOrderCard } from "@/features/distribution/draggable-order-card";
import { formatDistributionQueueSerial } from "@/features/distribution/distribution-queue-serial";
import { useAuthStore } from "@/stores/auth-store";
import type { ActiveMapCaptain } from "@/types/api";
import type { OrderListItem } from "@/types/api";

type PendingAssignmentUi = {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  captainId: string;
  captainName: string;
  mode: "manual" | "drag-drop";
};

/** Same order can briefly appear in more than one status query during refetch — dedupe so list keys stay unique. */
function dedupeOrdersById(orders: OrderListItem[]): OrderListItem[] {
  const seen = new Set<string>();
  const out: OrderListItem[] = [];
  for (const o of orders) {
    if (seen.has(o.id)) continue;
    seen.add(o.id);
    out.push(o);
  }
  return out;
}

function dedupeCaptainsById(captains: ActiveMapCaptain[]): ActiveMapCaptain[] {
  const map = new Map<string, ActiveMapCaptain>();
  for (const c of captains) {
    if (!map.has(c.id)) map.set(c.id, c);
  }
  return [...map.values()];
}

function useDispatchRole() {
  const role = useAuthStore((s) => s.user?.role);
  return role === "ADMIN" || role === "DISPATCHER";
}

export function DistributionPageView() {
  const token = useAuthStore((s) => s.token);
  const canDispatch = useDispatchRole();
  const [dragOrderId, setDragOrderId] = useState<string | null>(null);
  const [manualOrder, setManualOrder] = useState<OrderListItem | null>(null);
  const [pendingAssignments, setPendingAssignments] = useState<PendingAssignmentUi[]>([]);

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

  /** Totals for PENDING / CONFIRMED stat cards: same filters as pendingQ / confirmedQ — use their `total` (no extra pageSize:1 pollers). */
  const statsCaptains = useCaptains(
    { page: 1, pageSize: 1, isActive: true },
    { enabled: Boolean(token) && canDispatch, refetchInterval: distributionPollMs },
  );

  const captainPool = useCaptains({ page: 1, pageSize: 100 }, { enabled: Boolean(token) && canDispatch });

  const dashboardMapSettings = useDashboardSettings();
  const distributionMapView = useMemo(
    () => resolveDashboardMapView(dashboardMapSettings.data),
    [
      dashboardMapSettings.data?.mapDefaultLat,
      dashboardMapSettings.data?.mapDefaultLng,
      dashboardMapSettings.data?.mapDefaultZoom,
    ],
  );

  const mergedOrders = useMemo(() => {
    const a = pendingQ.data?.items ?? [];
    const b = confirmedQ.data?.items ?? [];
    const c = assignedQ.data?.items ?? [];
    const combined = [...c, ...a, ...b].sort((x, y) => (x.createdAt < y.createdAt ? 1 : -1));
    return dedupeOrdersById(combined);
  }, [assignedQ.data?.items, pendingQ.data?.items, confirmedQ.data?.items]);

  const mapCaptainsDeduped = useMemo(
    () => dedupeCaptainsById(mapCaptains.data ?? []),
    [mapCaptains.data],
  );
  const pendingOrderIds = useMemo(() => new Set(pendingAssignments.map((x) => x.orderId)), [pendingAssignments]);
  const pendingAssignmentsByOrderId = useMemo(
    () => new Map(pendingAssignments.map((x) => [x.orderId, x])),
    [pendingAssignments],
  );
  const pendingCaptainIds = useMemo(() => [...new Set(pendingAssignments.map((x) => x.captainId))], [pendingAssignments]);
  const ordersById = useMemo(() => new Map(mergedOrders.map((o) => [o.id, o])), [mergedOrders]);
  const captainNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of mapCaptainsDeduped) map.set(c.id, c.user.fullName);
    const pool = captainPool.data?.items ?? [];
    for (const c of pool) {
      if (!map.has(c.id)) map.set(c.id, c.user.fullName);
    }
    return map;
  }, [mapCaptainsDeduped, captainPool.data?.items]);

  const manualOrderLabel = useMemo(() => {
    if (!manualOrder) return "";
    const i = mergedOrders.findIndex((o) => o.id === manualOrder.id);
    if (i < 0) return manualOrder.orderNumber;
    return `${formatDistributionQueueSerial(i, mergedOrders.length)} · ${manualOrder.orderNumber}`;
  }, [manualOrder, mergedOrders]);

  const resend = useResendOrderToDistribution();
  const assign = useAssignOrderToCaptain();
  const removePendingAssignment = useCallback((id: string) => {
    setPendingAssignments((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const onAssignDrop = useCallback(
    (orderId: string, captainId: string) => {
      if (pendingOrderIds.has(orderId)) return;
      const order = ordersById.get(orderId);
      if (!order) return;
      const captainName = captainNameById.get(captainId) ?? "كابتن محدد";
      const optimisticId = `${order.id}:${captainId}:${Date.now()}`;
      setPendingAssignments((prev) => [
        ...prev,
        {
          id: optimisticId,
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          captainId,
          captainName,
          mode: "drag-drop",
        },
      ]);
      assign.mutate(
        { orderId, captainId, mode: "drag-drop", source: "distribution-map-drag-drop" },
        {
          onSettled: () => {
            removePendingAssignment(optimisticId);
          },
        },
      );
    },
    [assign, captainNameById, ordersById, pendingOrderIds, removePendingAssignment],
  );

  if (!token) return null;
  if (!canDispatch) return <Navigate to="/" replace />;

  const activeCaptainsTotal = statsCaptains.data?.total ?? "—";
  const pendingTotal = pendingQ.data?.total ?? "—";
  const confirmedTotal = confirmedQ.data?.total ?? "—";

  return (
    <div className="grid gap-6">
      <PageHeader
        title="التوزيع"
        description="اسحب بطاقة الطلب إلى الخريطة أو إلى قائمة الكباتن تحت الخريطة. الطلبات قيد التوزيع على اليمين."
      />

      <div className="grid gap-3 sm:grid-cols-3 [direction:rtl]">
        <StatCard label="كباتن نشطون" value={activeCaptainsTotal} hint="isActive = true" icon={Users} />
        <StatCard label="بانتظار التوزيع" value={pendingTotal} hint="حالة PENDING" icon={MapPinned} />
        <StatCard label="طلبات التجهيز" value={confirmedTotal} hint="حالة CONFIRMED" icon={ChefHat} />
      </div>

      {/* عمود الخريطة + الكباتن تحتها مباشرة | عمود الطلبات */}
      <section className="grid gap-4 [direction:ltr] lg:grid-cols-[minmax(0,1fr)_minmax(280px,400px)] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4 [direction:rtl]">
          <div className="min-h-[min(52vh,520px)] min-w-0 lg:min-h-[min(60vh,560px)]">
            <DistributionMap
              captains={mapCaptainsDeduped}
              onAssignDrop={onAssignDrop}
              draggingOrderId={dragOrderId}
              defaultCenter={distributionMapView.center}
              defaultZoom={distributionMapView.zoom}
            />
          </div>
          <div className="min-w-0">
            <h2 className="mb-2 text-base font-semibold leading-tight">الكباتن (إسقاط بالاسم)</h2>
            <CaptainQuickDropPanel
              captains={mapCaptainsDeduped}
              onDropOrderOnCaptain={onAssignDrop}
              pendingOrderIds={[...pendingOrderIds]}
              pendingCaptainIds={pendingCaptainIds}
            />
          </div>
        </div>

        <aside className="flex w-full min-h-0 min-w-0 max-h-[min(36rem,calc(100vh-6rem))] max-w-full flex-col overflow-hidden rounded-2xl border border-card-border bg-card shadow-sm [direction:rtl] [contain:layout] lg:sticky lg:top-6 lg:max-w-[400px] lg:self-start">
          <div className="shrink-0 border-b border-card-border bg-card px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-base font-semibold leading-tight">الطلبات قيد التوزيع</h2>
              {!pendingQ.isLoading && !confirmedQ.isLoading && !assignedQ.isLoading ? (
                <span
                  className="shrink-0 rounded-md bg-muted/80 px-2 py-0.5 font-mono text-xs tabular-nums text-muted-foreground"
                  title="عدد الطلبات في القائمة"
                >
                  {mergedOrders.length}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-[11px] leading-snug text-muted">
              بانتظار التوزيع، التجهيز، أو بانتظار رد الكابتن — اسحب البطاقة نحو الخريطة أو أسماء الكباتن أدناه
            </p>
          </div>
          {/* منطقة ثابتة الارتفاع: لا تدفع الصفحة للأسفل عند تدفق الطلبات؛ التمرير داخلي فقط */}
          <div className="min-h-0 max-h-[min(28rem,calc(100vh-10rem))] overflow-x-hidden overflow-y-auto overscroll-y-contain scroll-smooth px-2.5 py-2 pe-1.5 [scrollbar-gutter:stable]">
            {pendingQ.isLoading || confirmedQ.isLoading || assignedQ.isLoading ? (
              <p className="text-sm text-muted">جارٍ التحميل…</p>
            ) : mergedOrders.length === 0 ? (
              <p className="text-sm text-muted">لا توجد طلبات قيد التوزيع حالياً.</p>
            ) : (
              <ul className="flex list-none flex-col gap-2 p-0" aria-label="قائمة الطلبات قيد التوزيع">
                {mergedOrders.map((o, index) => (
                  <li key={o.id}>
                    <DraggableOrderCard
                      order={o}
                      queueSerial={formatDistributionQueueSerial(index, mergedOrders.length)}
                      onDragState={setDragOrderId}
                      onManual={setManualOrder}
                      onResend={(ord) =>
                        resend.mutate({
                          orderId: ord.id,
                          clickAtMs: performance.now(),
                          source: "distribution-queue-resend",
                        })
                      }
                      busy={resend.isPending || assign.isPending || pendingOrderIds.has(o.id)}
                      pendingAssignment={pendingAssignmentsByOrderId.get(o.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </section>

      <ManualAssignModal
        open={Boolean(manualOrder)}
        onClose={() => setManualOrder(null)}
        orderLabel={manualOrderLabel}
        captains={captainPool.data?.items ?? []}
        isPending={assign.isPending}
        onSubmit={(captainId) => {
          if (manualOrder && !pendingOrderIds.has(manualOrder.id)) {
            const optimisticId = `${manualOrder.id}:${captainId}:${Date.now()}`;
            const captainName = captainNameById.get(captainId) ?? "كابتن محدد";
            setPendingAssignments((prev) => [
              ...prev,
              {
                id: optimisticId,
                orderId: manualOrder.id,
                orderNumber: manualOrder.orderNumber,
                customerName: manualOrder.customerName,
                captainId,
                captainName,
                mode: "manual",
              },
            ]);
            assign.mutate(
              {
                orderId: manualOrder.id,
                captainId,
                mode: "manual",
                clickAtMs: performance.now(),
                source: "distribution-manual-assign-modal",
              },
              {
                onSuccess: () => setManualOrder(null),
                onSettled: () => {
                  removePendingAssignment(optimisticId);
                },
              },
            );
          }
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
