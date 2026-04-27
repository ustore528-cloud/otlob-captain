import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Radio } from "lucide-react";
import { Navigate } from "react-router-dom";
import {
  useAdminOverrideOrderStatus,
  useArchiveOrder,
  useAssignOrderToCaptain,
  useCancelOrderCaptainAssignment,
  useCaptains,
  useOrderDetail,
  useOrders,
  useReassignOrder,
  useResendOrderToDistribution,
  useStartOrderAutoDistribution,
  type AdminOverrideTargetStatus,
} from "@/hooks";
import { OrderDetailModal } from "@/features/orders/components/order-detail-modal";
import { ManualAssignModal } from "@/features/shared/manual-assign-modal";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { OrdersListSection } from "@/features/orders/components/orders-list-section";
import { ORDERS_PAGE_INITIAL_LIST_PARAMS } from "@/router/loaders";
import { canListOrdersRole, isCompanyAdminRole, isDispatchRole } from "@/lib/rbac-roles";
import { useAuthStore } from "@/stores/auth-store";
import { formatOrderDisplayLabel } from "@captain/shared";
import type { OrderListItem } from "@/types/api";

export function OrdersPageView() {
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.user?.role);
  const [status, setStatus] = useState(ORDERS_PAGE_INITIAL_LIST_PARAMS.status);
  const [q, setQ] = useState("");
  const [manualOrder, setManualOrder] = useState<OrderListItem | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<OrderListItem | null>(null);
  const [reassignOrder, setReassignOrder] = useState<OrderListItem | null>(null);
  const [statusOverrideOrder, setStatusOverrideOrder] = useState<OrderListItem | null>(null);
  const [statusOverrideTarget, setStatusOverrideTarget] = useState<AdminOverrideTargetStatus>("PENDING");
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);

  const canDispatch = isDispatchRole(role);
  const hideStoreInOrdersUi = isCompanyAdminRole(role);
  const canReadOrders = canListOrdersRole(role);
  if (!canReadOrders) return <Navigate to="/" replace />;

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
  const orderDetail = useOrderDetail(detailOrderId, { enabled: Boolean(detailOrderId) });
  const captains = useCaptains(
    { page: 1, pageSize: 100 },
    { enabled: canDispatch && (Boolean(manualOrder) || Boolean(reassignOrder)) },
  );

  const auto = useStartOrderAutoDistribution();
  const resend = useResendOrderToDistribution();
  const reassign = useReassignOrder();
  const cancelCaptain = useCancelOrderCaptainAssignment();
  const archiveOrder = useArchiveOrder();
  const adminOverrideStatus = useAdminOverrideOrderStatus();
  const assign = useAssignOrderToCaptain();
  const autoPendingOrderId = auto.isPending ? auto.variables : null;
  const resendPendingOrderId =
    resend.isPending && resend.variables
      ? typeof resend.variables === "string"
        ? resend.variables
        : resend.variables.orderId
      : null;
  const cancelPendingOrderId = cancelCaptain.isPending ? cancelCaptain.variables : null;
  const reassignPendingOrderId =
    reassign.isPending && reassign.variables ? reassign.variables.orderId : null;
  const archivePendingOrderId = archiveOrder.isPending ? archiveOrder.variables ?? null : null;
  const adminOverrideRowPendingOrderId =
    adminOverrideStatus.isPending && adminOverrideStatus.variables
      ? adminOverrideStatus.variables.orderId
      : null;

  const rows = orders.data?.items ?? [];

  const filterNote = useMemo(() => {
    if (!q.trim()) return null;
    return /^[\d+\s()-]{5,}$/.test(q.trim()) ? t("orders.filter.byPhone") : t("orders.filter.byOrderNumber");
  }, [q, t]);

  return (
    <div className="grid gap-8">
      <PageHeader
        title={t("orders.page.title")}
        description={t("orders.page.description")}
        divider
        actions={
          <Button type="button" variant="secondary" onClick={() => void orders.refetch()} disabled={orders.isFetching}>
            <Radio className="opacity-80" />
            {t("common.refresh")}
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
        onResend={(id) => resend.mutate({ orderId: id, clickAtMs: performance.now(), source: "orders-table-resend" })}
        onReassign={(order) => setReassignOrder(order)}
        onCancelCaptain={(id) => cancelCaptain.mutate(id)}
        autoPendingOrderId={autoPendingOrderId}
        resendPendingOrderId={resendPendingOrderId}
        cancelPendingOrderId={cancelPendingOrderId}
        reassignPendingOrderId={reassignPendingOrderId}
        archivePendingOrderId={archivePendingOrderId}
        onArchive={canDispatch ? (o) => setArchiveTarget(o) : undefined}
        archiveConfirmOrder={archiveTarget}
        onArchiveConfirmClose={() => setArchiveTarget(null)}
        onArchiveConfirm={() => {
          if (!archiveTarget) return;
          archiveOrder.mutate(archiveTarget.id, {
            onSuccess: () => setArchiveTarget(null),
          });
        }}
        adminOverrideOrder={statusOverrideOrder}
        adminOverrideTarget={statusOverrideTarget}
        onAdminOverrideTargetChange={setStatusOverrideTarget}
        onAdminOverrideOpen={(o) => {
          setStatusOverrideTarget("PENDING");
          setStatusOverrideOrder(o);
        }}
        onAdminOverrideClose={() => setStatusOverrideOrder(null)}
        onAdminOverrideConfirm={() => {
          if (!statusOverrideOrder) return;
          adminOverrideStatus.mutate(
            { orderId: statusOverrideOrder.id, status: statusOverrideTarget },
            { onSuccess: () => setStatusOverrideOrder(null) },
          );
        }}
        adminOverridePending={adminOverrideStatus.isPending}
        adminOverrideRowPendingOrderId={adminOverrideRowPendingOrderId}
        onOpenDetail={(o) => setDetailOrderId(o.id)}
      />

      <OrderDetailModal
        open={Boolean(detailOrderId)}
        onClose={() => setDetailOrderId(null)}
        loading={orderDetail.isLoading}
        error={orderDetail.isError ? (orderDetail.error as Error) : null}
        order={orderDetail.data}
        hideStoreSection={hideStoreInOrdersUi}
      />

      <ManualAssignModal
        open={Boolean(manualOrder)}
        onClose={() => setManualOrder(null)}
        orderLabel={
          manualOrder
            ? formatOrderDisplayLabel(manualOrder.displayOrderNo ?? null, manualOrder.orderNumber)
            : ""
        }
        captains={captains.data?.items ?? []}
        isPending={assign.isPending}
        onSubmit={(captainId) => {
          if (manualOrder)
            assign.mutate(
              {
                orderId: manualOrder.id,
                captainId,
                mode: "manual",
                clickAtMs: performance.now(),
                source: "orders-manual-assign-modal",
              },
              { onSuccess: () => setManualOrder(null) },
            );
        }}
      />

      <ManualAssignModal
        open={Boolean(reassignOrder)}
        onClose={() => setReassignOrder(null)}
        title={t("manualAssign.reassignTitle")}
        description={
          reassignOrder
            ? t("manualAssign.reassignDescription", {
                order: formatOrderDisplayLabel(reassignOrder.displayOrderNo ?? null, reassignOrder.orderNumber),
              })
            : undefined
        }
        orderLabel={
          reassignOrder
            ? formatOrderDisplayLabel(reassignOrder.displayOrderNo ?? null, reassignOrder.orderNumber)
            : ""
        }
        captains={captains.data?.items ?? []}
        isPending={reassign.isPending}
        onSubmit={(captainId) => {
          if (!reassignOrder) return;
          reassign.mutate(
            { orderId: reassignOrder.id, captainId },
            {
              onSuccess: () => setReassignOrder(null),
            },
          );
        }}
      />
    </div>
  );
}
