import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { FORM_CONTROL_CLASS } from "@/components/ui/form-field-classes";
import { InlineAlert } from "@/components/ui/inline-alert";
import { LoadingBlock } from "@/components/ui/loading-block";
import { TableShell } from "@/components/ui/table-shell";
import { orderStatusBadgeVariant, orderStatusLabel } from "@/lib/order-status";
import { ORDER_STATUS_FILTER_VALUES } from "@/features/orders/constants";
import { storeSubscriptionLabel } from "@/lib/store-subscription-label";
import { tableDateLocale } from "@/i18n/date-locale";
import { ADMIN_OVERRIDE_TARGET_STATUSES, type AdminOverrideTargetStatus } from "@/hooks";
import { formatOrderDisplayLabel } from "@captain/shared";
import type { OrderListItem, OrderStatus } from "@/types/api";
import { OrderFinancialStrip } from "@/features/orders/components/order-financial-strip";
import { useLocalizedOrderListItem } from "@/i18n/use-localized-order-display";

function canArchiveOrderStatus(status: OrderStatus): boolean {
  return !["ACCEPTED", "PICKED_UP", "IN_TRANSIT"].includes(status);
}

type Props = {
  search: string;
  onSearchChange: (v: string) => void;
  status: string;
  onStatusChange: (v: string) => void;
  filterNote: string | null;
  loading: boolean;
  error: Error | null;
  rows: OrderListItem[];
  canDispatch: boolean;
  onAuto: (orderId: string) => void;
  onManual: (order: OrderListItem) => void;
  onResend: (orderId: string) => void;
  onReassign: (order: OrderListItem) => void;
  onCancelCaptain: (orderId: string) => void;
  autoPendingOrderId: string | null;
  resendPendingOrderId: string | null;
  cancelPendingOrderId: string | null;
  /** Disable the reassign button only for the row where the request is in flight */
  reassignPendingOrderId: string | null;
  /** Disable the remove-from-list button only for the row where the request is in flight */
  archivePendingOrderId: string | null;
  onArchive?: (order: OrderListItem) => void;
  archiveConfirmOrder: OrderListItem | null;
  onArchiveConfirmClose: () => void;
  onArchiveConfirm: () => void;
  adminOverrideOrder: OrderListItem | null;
  adminOverrideTarget: AdminOverrideTargetStatus;
  onAdminOverrideTargetChange: (v: AdminOverrideTargetStatus) => void;
  onAdminOverrideOpen: (order: OrderListItem) => void;
  onAdminOverrideClose: () => void;
  onAdminOverrideConfirm: () => void;
  adminOverridePending: boolean;
  /** Disable the table “edit status” button only for the row where the request is in flight */
  adminOverrideRowPendingOrderId: string | null;
  onOpenDetail?: (order: OrderListItem) => void;
  /** Company Admin: hide store column and neutral financial wording */
  hideStoreContext?: boolean;
};

type OrderListTableRowProps = {
  o: OrderListItem;
  t: TFunction;
  dateLocale: string;
} & Pick<
  Props,
  | "hideStoreContext"
  | "canDispatch"
  | "onOpenDetail"
  | "onAuto"
  | "onManual"
  | "onResend"
  | "onReassign"
  | "onCancelCaptain"
  | "autoPendingOrderId"
  | "resendPendingOrderId"
  | "cancelPendingOrderId"
  | "reassignPendingOrderId"
  | "onArchive"
  | "archivePendingOrderId"
  | "onAdminOverrideOpen"
  | "adminOverrideRowPendingOrderId"
>;

function OrderListTableRow({
  o,
  t,
  dateLocale,
  hideStoreContext,
  canDispatch,
  onOpenDetail,
  onAuto,
  onManual,
  onResend,
  onReassign,
  onCancelCaptain,
  autoPendingOrderId,
  resendPendingOrderId,
  cancelPendingOrderId,
  reassignPendingOrderId,
  onArchive,
  archivePendingOrderId,
  onAdminOverrideOpen,
  adminOverrideRowPendingOrderId,
}: OrderListTableRowProps) {
  const loc = useLocalizedOrderListItem(o);
  return (
    <tr className="hover:bg-accent/40">
      <td
        className="border-b border-card-border px-3 py-3 align-top text-sm tabular-nums"
        dir="ltr"
        title={o.orderNumber}
      >
        {formatOrderDisplayLabel(o.displayOrderNo ?? null, o.orderNumber)}
      </td>
      <td className="border-b border-card-border px-3 py-3 align-top min-w-[200px] max-w-[260px]">
        <OrderFinancialStrip
          amount={o.amount}
          cashCollection={o.cashCollection}
          deliveryFee={o.deliveryFee ?? null}
          variant="list"
          amountLineKey={hideStoreContext ? "orderAmount" : "storeAmount"}
        />
      </td>
      <td className="border-b border-card-border px-3 py-3 align-top">
        <Badge variant={orderStatusBadgeVariant(o.status)}>{orderStatusLabel(o.status)}</Badge>
      </td>
      <td className="border-b border-card-border px-3 py-3 align-top">
        <div className="font-medium">{loc.customerName}</div>
        <div className="text-xs text-muted" dir="ltr">
          {o.customerPhone}
        </div>
      </td>
      {hideStoreContext ? null : (
        <td className="border-b border-card-border px-3 py-3 align-top text-xs">
          <div className="font-medium text-foreground">{loc.storeName}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge variant="muted" className="font-normal">
              {storeSubscriptionLabel(o.store.subscriptionType)}
            </Badge>
            <span className="font-mono text-[10px] text-muted" dir="ltr">
              {o.store.subscriptionType}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-muted">
            {t("orders.list.supervisor")}:{" "}
            {o.store.supervisorUser ? (
              <>
                {loc.supervisorName}
                <span className="mx-0.5">·</span>
                <span dir="ltr">{o.store.supervisorUser.phone}</span>
              </>
            ) : (
              t("orders.list.noSupervisor")
            )}
          </div>
          <div className="mt-0.5 text-[11px] text-muted">
            {t("orders.list.region")}:{" "}
            {o.store.primaryRegion ? (
              <>
                {loc.primaryRegionName}
                <span className="mx-0.5 font-mono text-[10px]" dir="ltr">
                  ({o.store.primaryRegion.code})
                </span>
              </>
            ) : (
              "—"
            )}
          </div>
        </td>
      )}
      <td className="border-b border-card-border px-3 py-3 align-top text-xs">{loc.area}</td>
      <td className="border-b border-card-border px-3 py-3 align-top text-xs text-muted" dir="ltr">
        {new Date(o.createdAt).toLocaleString(dateLocale, { hour12: false })}
      </td>
      <td className="border-b border-card-border px-3 py-3 align-top">
        <div className="flex flex-wrap gap-2">
          {onOpenDetail ? (
            <Button type="button" size="sm" variant="secondary" onClick={() => onOpenDetail(o)}>
              {t("orders.list.detail")}
            </Button>
          ) : null}
          {canDispatch && (o.status === "PENDING" || o.status === "CONFIRMED") ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={autoPendingOrderId === o.id}
              onClick={() => onAuto(o.id)}
            >
              {t("orders.list.autoDist")}
            </Button>
          ) : null}
          {canDispatch ? (
            <Button size="sm" variant="secondary" onClick={() => onManual(o)}>
              {t("orders.list.manualAssign")}
            </Button>
          ) : null}
          {canDispatch && o.status !== "DELIVERED" && o.status !== "CANCELLED" ? (
            <Button
              size="sm"
              variant="default"
              disabled={resendPendingOrderId === o.id}
              onClick={() => onResend(o.id)}
            >
              {t("orders.list.redistribute")}
            </Button>
          ) : null}
          {canDispatch &&
          o.assignedCaptain &&
          (o.status === "ASSIGNED" || o.status === "ACCEPTED" || o.status === "PICKED_UP") ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={reassignPendingOrderId === o.id}
              onClick={() => onReassign(o)}
            >
              {t("orders.list.reassign")}
            </Button>
          ) : null}
          {canDispatch &&
          o.assignedCaptain &&
          (o.status === "ASSIGNED" || o.status === "ACCEPTED" || o.status === "PICKED_UP") ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={cancelPendingOrderId === o.id}
              onClick={() => onCancelCaptain(o.id)}
            >
              {t("orders.list.cancelForCaptain")}
            </Button>
          ) : null}
          {canDispatch ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="border-amber-200/80 text-amber-950 hover:bg-amber-50"
              disabled={adminOverrideRowPendingOrderId === o.id}
              onClick={() => onAdminOverrideOpen(o)}
            >
              {t("orders.list.adminOverride")}
            </Button>
          ) : null}
          {canDispatch && onArchive && canArchiveOrderStatus(o.status) ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="border-red-200 text-red-800 hover:bg-red-50"
              disabled={archivePendingOrderId === o.id}
              onClick={() => onArchive(o)}
            >
              {t("orders.list.removeFromList")}
            </Button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

export function OrdersListSection({
  search,
  onSearchChange,
  status,
  onStatusChange,
  filterNote,
  loading,
  error,
  rows,
  canDispatch,
  onAuto,
  onManual,
  onResend,
  onReassign,
  onCancelCaptain,
  autoPendingOrderId,
  resendPendingOrderId,
  cancelPendingOrderId,
  reassignPendingOrderId,
  archivePendingOrderId,
  onArchive,
  archiveConfirmOrder,
  onArchiveConfirmClose,
  onArchiveConfirm,
  adminOverrideOrder,
  adminOverrideTarget,
  onAdminOverrideTargetChange,
  onAdminOverrideOpen,
  onAdminOverrideClose,
  onAdminOverrideConfirm,
  adminOverridePending,
  adminOverrideRowPendingOrderId,
  onOpenDetail,
  hideStoreContext = false,
}: Props) {
  const { t, i18n } = useTranslation();
  const dateLocale = tableDateLocale(i18n.resolvedLanguage ?? i18n.language);

  return (
    <Card className="border-card-border shadow-sm ring-1 ring-card-border/70">
      <CardHeader className="grid gap-4 border-b border-card-border/70 pb-5 sm:flex sm:flex-row sm:items-end sm:justify-between">
        <div>
          <CardTitle className="text-base">{t("orders.list.filterTitle")}</CardTitle>
          <CardDescription>{t("orders.list.filterDesc")}</CardDescription>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="grid gap-1">
            <Label className="text-xs text-muted">{t("orders.list.searchLabel")}</Label>
            <Input
              dir="ltr"
              className="w-56 text-left"
              placeholder={t("orders.list.searchPlaceholder")}
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs text-muted">{t("orders.list.statusLabel")}</Label>
            <select className={FORM_CONTROL_CLASS} value={status} onChange={(e) => onStatusChange(e.target.value)}>
              {ORDER_STATUS_FILTER_VALUES.map((v) => (
                <option key={v || "all"} value={v}>
                  {v === "" ? t("orders.list.statusAll") : t(`orderStatus.${v}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 pt-4">
        {filterNote ? <p className="mb-3 text-xs text-muted">{filterNote}</p> : null}
        {loading ? (
          <LoadingBlock message={t("orders.list.loading")} compact />
        ) : error ? (
          <InlineAlert variant="error">{error.message}</InlineAlert>
        ) : rows.length === 0 ? (
          <EmptyState title={t("orders.list.emptyTitle")} description={t("orders.list.emptyDesc")} className="py-10" />
        ) : (
          <>
          <Modal
            open={Boolean(adminOverrideOrder)}
            onClose={onAdminOverrideClose}
            title={t("orders.list.adminModalTitle")}
            description={t("orders.list.adminModalDesc")}
          >
            <div className="grid gap-3">
              {adminOverrideOrder ? (
                <p className="text-sm text-muted">
                  {t("orders.list.adminOrderLine", {
                    number: adminOverrideOrder.orderNumber,
                    status: orderStatusLabel(adminOverrideOrder.status),
                  })}
                </p>
              ) : null}
              <div className="grid gap-1">
                <Label className="text-xs text-muted">{t("orders.list.adminTargetLabel")}</Label>
                <select
                  className={FORM_CONTROL_CLASS}
                  value={adminOverrideTarget}
                  onChange={(e) => onAdminOverrideTargetChange(e.target.value as AdminOverrideTargetStatus)}
                >
                  {ADMIN_OVERRIDE_TARGET_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {orderStatusLabel(s)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <Button type="button" variant="secondary" onClick={onAdminOverrideClose}>
                  {t("common.cancel")}
                </Button>
                <Button type="button" variant="default" disabled={adminOverridePending} onClick={onAdminOverrideConfirm}>
                  {t("orders.list.adminConfirm")}
                </Button>
              </div>
            </div>
          </Modal>
          <Modal
            open={Boolean(archiveConfirmOrder)}
            onClose={onArchiveConfirmClose}
            title={t("orders.list.archiveTitle")}
            description={t("orders.list.archiveDesc")}
          >
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" onClick={onArchiveConfirmClose}>
                {t("common.cancel")}
              </Button>
              <Button type="button" variant="default" disabled={Boolean(archivePendingOrderId)} onClick={onArchiveConfirm}>
                {t("orders.list.archiveConfirm")}
              </Button>
            </div>
          </Modal>
          <TableShell>
          <table
            className={`w-full border-separate border-spacing-0 text-sm ${
              hideStoreContext
                ? "min-w-[900px] md:min-w-[980px]"
                : "min-w-[1100px] md:min-w-[1180px]"
            }`}
          >
            <thead>
              <tr className="bg-muted/30 text-muted">
                <th className="border-b border-card-border px-3 py-2 text-right font-medium">{t("orders.list.colOrder")}</th>
                <th className="border-b border-card-border px-3 py-2 text-left font-medium" dir="ltr">
                  {t("orders.list.colFinancials")}
                </th>
                <th className="border-b border-card-border px-3 py-2 text-right font-medium">{t("orders.list.colStatus")}</th>
                <th className="border-b border-card-border px-3 py-2 text-right font-medium">{t("orders.list.colCustomer")}</th>
                {hideStoreContext ? null : (
                  <th className="border-b border-card-border px-3 py-2 text-right font-medium">{t("orders.list.colStore")}</th>
                )}
                <th className="border-b border-card-border px-3 py-2 text-right font-medium">{t("orders.list.colArea")}</th>
                <th className="border-b border-card-border px-3 py-2 text-right font-medium">{t("orders.list.colDate")}</th>
                <th className="border-b border-card-border px-3 py-2 text-right font-medium">{t("orders.list.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <OrderListTableRow
                  key={o.id}
                  o={o}
                  t={t}
                  dateLocale={dateLocale}
                  hideStoreContext={hideStoreContext}
                  canDispatch={canDispatch}
                  onOpenDetail={onOpenDetail}
                  onAuto={onAuto}
                  onManual={onManual}
                  onResend={onResend}
                  onReassign={onReassign}
                  onCancelCaptain={onCancelCaptain}
                  autoPendingOrderId={autoPendingOrderId}
                  resendPendingOrderId={resendPendingOrderId}
                  cancelPendingOrderId={cancelPendingOrderId}
                  reassignPendingOrderId={reassignPendingOrderId}
                  onArchive={onArchive}
                  archivePendingOrderId={archivePendingOrderId}
                  onAdminOverrideOpen={onAdminOverrideOpen}
                  adminOverrideRowPendingOrderId={adminOverrideRowPendingOrderId}
                />
              ))}
            </tbody>
          </table>
          </TableShell>
          </>
        )}
      </CardContent>
    </Card>
  );
}
