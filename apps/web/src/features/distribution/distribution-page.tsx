import { type ReactNode, useCallback, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { ClipboardList, MapPinned, Settings, Users, FileBarChart2, Route } from "lucide-react";
import { toast } from "sonner";
import {
  useAssignOrderToCaptain,
  useCaptainLocations,
  useCaptains,
  useDashboardSettings,
  useOrders,
  useResendOrderToDistribution,
} from "@/hooks";
import { resolveDashboardMapView } from "@/features/distribution/map-default-view";
import { ManualAssignModal } from "@/features/shared/manual-assign-modal";
import { PageHeader } from "@/components/layout/page-header";
import { ASSIGNED_LIST_PARAMS, CONFIRMED_LIST_PARAMS, PENDING_LIST_PARAMS } from "@/features/distribution/constants";
import { formatDistributionQueueSerial } from "@/features/distribution/distribution-queue-serial";
import { AutoDistributeButton } from "@/features/distribution/components/auto-distribute-button";
import { CaptainMiniCard } from "@/features/distribution/components/captain-mini-card";
import { DistributionMap } from "@/features/distribution/distribution-map";
import { GoogleTrackingMap, hasGoogleMapsApiKey } from "@/features/distribution/components/google-tracking-map";
import { OrdersPanel } from "@/features/distribution/components/orders-panel";
import { filterCaptainsForManualAssign, isCaptainRosterDropAllowed } from "@/features/distribution/supervisor-assign-ui";
import { isDispatchRole } from "@/lib/rbac-roles";
import { useAuthStore } from "@/stores/auth-store";
import type { ActiveMapCaptain, OrderListItem } from "@/types/api";

type PendingAssignmentUi = {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  captainId: string;
  captainName: string;
  mode: "manual" | "drag-drop";
};

type CaptainFilter = "all" | "available" | "waiting" | "busy" | "far";

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
  for (const c of captains) if (!map.has(c.id)) map.set(c.id, c);
  return [...map.values()];
}

function useDispatchRole() {
  const role = useAuthStore((s) => s.user?.role);
  return isDispatchRole(role);
}

export function DistributionPageView() {
  const token = useAuthStore((s) => s.token);
  const canDispatch = useDispatchRole();
  const [dragOrderId, setDragOrderId] = useState<string | null>(null);
  const [manualOrder, setManualOrder] = useState<OrderListItem | null>(null);
  const [pendingAssignments, setPendingAssignments] = useState<PendingAssignmentUi[]>([]);
  const [captainFilter, setCaptainFilter] = useState<CaptainFilter>("all");

  const distributionPollMs = 4000;
  const pendingQ = useOrders(PENDING_LIST_PARAMS, { enabled: Boolean(token) && canDispatch, refetchInterval: distributionPollMs });
  const confirmedQ = useOrders(CONFIRMED_LIST_PARAMS, { enabled: Boolean(token) && canDispatch, refetchInterval: distributionPollMs });
  const assignedQ = useOrders(ASSIGNED_LIST_PARAMS, { enabled: Boolean(token) && canDispatch, refetchInterval: distributionPollMs });
  const { activeMap: mapCaptains } = useCaptainLocations({ enabledLatest: false, activeMapRefetchInterval: distributionPollMs });
  const statsCaptains = useCaptains({ page: 1, pageSize: 1, isActive: true }, { enabled: Boolean(token) && canDispatch, refetchInterval: distributionPollMs });
  const captainPool = useCaptains({ page: 1, pageSize: 100 }, { enabled: Boolean(token) && canDispatch });
  const dashboardMapSettings = useDashboardSettings();
  const distributionMapView = useMemo(
    () => resolveDashboardMapView(dashboardMapSettings.data),
    [dashboardMapSettings.data?.mapDefaultLat, dashboardMapSettings.data?.mapDefaultLng, dashboardMapSettings.data?.mapDefaultZoom],
  );

  const mergedOrders = useMemo(() => {
    const a = pendingQ.data?.items ?? [];
    const b = confirmedQ.data?.items ?? [];
    const c = assignedQ.data?.items ?? [];
    return dedupeOrdersById([...c, ...a, ...b].sort((x, y) => (x.createdAt < y.createdAt ? 1 : -1)));
  }, [assignedQ.data?.items, pendingQ.data?.items, confirmedQ.data?.items]);

  const mapCaptainsDeduped = useMemo(() => dedupeCaptainsById(mapCaptains.data ?? []), [mapCaptains.data]);
  const pendingOrderIds = useMemo(() => new Set(pendingAssignments.map((x) => x.orderId)), [pendingAssignments]);
  const pendingCaptainIds = useMemo(() => [...new Set(pendingAssignments.map((x) => x.captainId))], [pendingAssignments]);
  const ordersById = useMemo(() => new Map(mergedOrders.map((o) => [o.id, o])), [mergedOrders]);
  const captainRoster = captainPool.data?.items ?? [];
  const captainNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of mapCaptainsDeduped) map.set(c.id, c.user.fullName);
    for (const c of captainRoster) if (!map.has(c.id)) map.set(c.id, c.user.fullName);
    return map;
  }, [mapCaptainsDeduped, captainRoster]);

  const manualAssignCaptains = useMemo(
    () => (manualOrder ? filterCaptainsForManualAssign(manualOrder, captainRoster) : []),
    [manualOrder, captainRoster],
  );
  const manualAssignEmptyHint = useMemo(() => {
    if (!manualOrder || manualOrder.store.subscriptionType !== "SUPERVISOR_LINKED") return undefined;
    if (manualAssignCaptains.length > 0) return undefined;
    return "لا يوجد في الصفحة الحالية كباتن متوافقون مع مشرف المتجر.";
  }, [manualOrder, manualAssignCaptains.length]);

  const dropScopeGuard = useCallback(
    (orderId: string, captainId: string) => {
      const o = ordersById.get(orderId);
      if (!o) return true;
      return isCaptainRosterDropAllowed(o, captainId, captainRoster);
    },
    [ordersById, captainRoster],
  );
  const onDropScopeRejected = useCallback(() => toast.error("هذا الكابتن خارج نطاق مشرف المتجر لهذا الطلب."), []);

  const manualOrderLabel = useMemo(() => {
    if (!manualOrder) return "";
    const i = mergedOrders.findIndex((o) => o.id === manualOrder.id);
    if (i < 0) return manualOrder.orderNumber;
    return `${formatDistributionQueueSerial(i, mergedOrders.length)} · ${manualOrder.orderNumber}`;
  }, [manualOrder, mergedOrders]);

  const resend = useResendOrderToDistribution();
  const assign = useAssignOrderToCaptain();
  const removePendingAssignment = useCallback((id: string) => setPendingAssignments((prev) => prev.filter((x) => x.id !== id)), []);

  const onAssignDrop = useCallback(
    (orderId: string, captainId: string) => {
      if (pendingOrderIds.has(orderId)) return;
      const order = ordersById.get(orderId);
      if (!order) return;
      const captainName = captainNameById.get(captainId) ?? "كابتن محدد";
      const optimisticId = `${order.id}:${captainId}:${Date.now()}`;
      setPendingAssignments((prev) => [...prev, { id: optimisticId, orderId: order.id, orderNumber: order.orderNumber, customerName: order.customerName, captainId, captainName, mode: "drag-drop" }]);
      assign.mutate(
        { orderId, captainId, mode: "drag-drop", source: "distribution-dashboard-drag-drop" },
        { onSettled: () => removePendingAssignment(optimisticId) },
      );
    },
    [assign, captainNameById, ordersById, pendingOrderIds, removePendingAssignment],
  );

  if (!token) return null;
  if (!canDispatch) return <Navigate to="/" replace />;

  const newOrdersCount = Number(pendingQ.data?.total ?? 0) + Number(confirmedQ.data?.total ?? 0);
  const availableCaptains = Number(statsCaptains.data?.total ?? 0);
  const waitingCaptains = mapCaptainsDeduped.filter((c) => c.waitingOffers > 0).length;
  const busyCaptains = mapCaptainsDeduped.filter((c) => c.activeOrders > 0).length;
  const delayedOrders = mergedOrders.filter((o) => Date.now() - Date.parse(o.createdAt) > 20 * 60 * 1000).length;

  const filteredCaptains = mapCaptainsDeduped.filter((c) => {
    if (captainFilter === "all") return true;
    if (captainFilter === "available") return c.availabilityStatus === "AVAILABLE" && c.activeOrders === 0 && c.waitingOffers === 0;
    if (captainFilter === "waiting") return c.waitingOffers > 0;
    if (captainFilter === "busy") return c.activeOrders > 0;
    return !c.lastLocation || c.availabilityStatus !== "AVAILABLE";
  });

  return (
    <div className="grid gap-6 [direction:rtl]">
      <PageHeader title="لوحة توزيع الطلبات" description="إدارة مباشرة للكباتن والطلبات على الخريطة" />

      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-card-border bg-white p-3 shadow-sm sm:grid-cols-5">
        <StatBox label="الطلبات الجديدة" value={newOrdersCount} tone="text-primary" />
        <StatBox label="المتاحون" value={availableCaptains} tone="text-emerald-600" />
        <StatBox label="بانتظار الرد" value={waitingCaptains} tone="text-amber-600" />
        <StatBox label="المشغولون" value={busyCaptains} tone="text-rose-600" />
        <StatBox label="الطلبات المتأخرة" value={delayedOrders} tone="text-orange-600" />
      </div>

      <section className="grid gap-4 [direction:ltr] lg:grid-cols-[56px_minmax(300px,360px)_minmax(0,1fr)_minmax(280px,340px)]">
        <aside className="flex flex-col items-center gap-2 rounded-2xl border border-card-border bg-white p-2 shadow-sm [direction:rtl]">
          <RailIcon label="التوزيع" active icon={<Route className="size-5" />} />
          <RailIcon label="الكباتن" icon={<Users className="size-5" />} />
          <RailIcon label="الطلبات" icon={<ClipboardList className="size-5" />} />
          <RailIcon label="الخريطة" icon={<MapPinned className="size-5" />} />
          <RailIcon label="التقارير" icon={<FileBarChart2 className="size-5" />} />
          <div className="mt-auto" />
          <RailIcon label="الإعدادات" icon={<Settings className="size-5" />} />
        </aside>

        <aside className="rounded-2xl border border-card-border bg-white p-3 shadow-sm [direction:rtl]">
          <AutoDistributeButton orderIds={mergedOrders.map((o) => o.id)} />
          <div className="mt-3 flex flex-wrap gap-1">
            <FilterChip label="الكل" active={captainFilter === "all"} onClick={() => setCaptainFilter("all")} />
            <FilterChip label="المتاحون" active={captainFilter === "available"} onClick={() => setCaptainFilter("available")} />
            <FilterChip label="بانتظار الرد" active={captainFilter === "waiting"} onClick={() => setCaptainFilter("waiting")} />
            <FilterChip label="مشغول" active={captainFilter === "busy"} onClick={() => setCaptainFilter("busy")} />
            <FilterChip label="بعيد" active={captainFilter === "far"} onClick={() => setCaptainFilter("far")} />
          </div>
          <div className="mt-3 grid max-h-[calc(100vh-270px)] grid-cols-4 gap-2 overflow-y-auto">
            {filteredCaptains.map((c) => (
              <CaptainMiniCard
                key={c.id}
                captain={c}
                pending={pendingCaptainIds.includes(c.id)}
                onDropOrderOnCaptain={onAssignDrop}
                activeDragOrderId={dragOrderId}
                dropAllow={dropScopeGuard}
                onDropRejectedByGuard={onDropScopeRejected}
              />
            ))}
          </div>
        </aside>

        <div className="rounded-2xl border border-card-border bg-white p-3 shadow-sm [direction:rtl]">
          {hasGoogleMapsApiKey() ? (
            <GoogleTrackingMap
              captains={mapCaptainsDeduped}
              orders={mergedOrders}
              defaultCenter={distributionMapView.center}
              defaultZoom={distributionMapView.zoom}
            />
          ) : (
            <DistributionMap
              captains={mapCaptainsDeduped}
              onAssignDrop={onAssignDrop}
              draggingOrderId={dragOrderId}
              defaultCenter={distributionMapView.center}
              defaultZoom={distributionMapView.zoom}
              dropAllow={dropScopeGuard}
              onDropRejectedByGuard={onDropScopeRejected}
            />
          )}
        </div>

        <div dir="rtl">
          <OrdersPanel
            orders={mergedOrders}
            pendingOrderIds={pendingOrderIds}
            onManual={setManualOrder}
            onResend={(ord) =>
              resend.mutate({
                orderId: ord.id,
                clickAtMs: performance.now(),
                source: "distribution-queue-resend",
              })
            }
            onDragState={setDragOrderId}
          />
        </div>
      </section>

      <ManualAssignModal
        open={Boolean(manualOrder)}
        onClose={() => setManualOrder(null)}
        orderLabel={manualOrderLabel}
        captains={manualOrder ? manualAssignCaptains : []}
        emptyHint={manualAssignEmptyHint}
        isPending={assign.isPending}
        onSubmit={(captainId) => {
          if (!manualOrder || pendingOrderIds.has(manualOrder.id)) return;
          const optimisticId = `${manualOrder.id}:${captainId}:${Date.now()}`;
          const captainName = captainNameById.get(captainId) ?? "كابتن محدد";
          setPendingAssignments((prev) => [...prev, { id: optimisticId, orderId: manualOrder.id, orderNumber: manualOrder.orderNumber, customerName: manualOrder.customerName, captainId, captainName, mode: "manual" }]);
          assign.mutate(
            { orderId: manualOrder.id, captainId, mode: "manual", clickAtMs: performance.now(), source: "distribution-manual-assign-modal" },
            {
              onSuccess: () => setManualOrder(null),
              onSettled: () => removePendingAssignment(optimisticId),
            },
          );
        }}
      />
    </div>
  );
}

function StatBox({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 text-center">
      <p className="text-xs text-muted">{label}</p>
      <p className={`text-2xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-full px-2 py-1 text-xs ${active ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700"}`}>
      {label}
    </button>
  );
}

function RailIcon({ label, icon, active = false }: { label: string; icon: ReactNode; active?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={`rounded-xl p-2 transition ${
        active ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
      }`}
    >
      {icon}
    </button>
  );
}
