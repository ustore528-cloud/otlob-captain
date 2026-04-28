import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FORM_CONTROL_CLASS } from "@/components/ui/form-field-classes";
import { Input } from "@/components/ui/input";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Label } from "@/components/ui/label";
import { LoadingBlock } from "@/components/ui/loading-block";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat-tile";
import { TableShell } from "@/components/ui/table-shell";
import { useCaptainOrdersReport, useCaptainStats } from "@/hooks";
import { orderStatusBadgeVariant, orderStatusLabel } from "@/lib/order-status";
import { ORDER_STATUS_FILTER_VALUES } from "@/features/orders/constants";
import type { CaptainListItem, OrderListItem } from "@/types/api";
import { captainUserNameDisplay } from "@/i18n/localize-entity-labels";
import { useLocalizedOrderListItem } from "@/i18n/use-localized-order-display";
import type { CaptainOrdersQueryParams } from "@/lib/api/query-keys";

type Props = {
  captain: CaptainListItem | null;
  open: boolean;
  onClose: () => void;
};

function buildQueryParams(f: {
  page: number;
  pageSize: number;
  from: string;
  to: string;
  q: string;
  area: string;
  status: string;
}): CaptainOrdersQueryParams {
  return {
    page: f.page,
    pageSize: f.pageSize,
    ...(f.from ? { from: f.from } : {}),
    ...(f.to ? { to: f.to } : {}),
    ...(f.q.trim() ? { q: f.q.trim() } : {}),
    ...(f.area.trim() ? { area: f.area.trim() } : {}),
    ...(f.status ? { status: f.status } : {}),
  };
}

function CaptainReportOrderRow({ order }: { order: OrderListItem }) {
  const loc = useLocalizedOrderListItem(order);
  return (
    <tr className="hover:bg-accent/40">
      <td className="border-b border-card-border px-3 py-2 align-top font-mono text-xs" dir="ltr">
        {order.orderNumber}
      </td>
      <td className="border-b border-card-border px-3 py-2 align-top">
        <Badge variant={orderStatusBadgeVariant(order.status)}>{orderStatusLabel(order.status)}</Badge>
      </td>
      <td className="border-b border-card-border px-3 py-2 align-top">
        <div className="font-medium">{loc.customerName}</div>
        <div className="text-xs text-muted" dir="ltr">
          {order.customerPhone}
        </div>
      </td>
      <td className="border-b border-card-border px-3 py-2 align-top text-xs">{loc.area}</td>
      <td className="border-b border-card-border px-3 py-2 align-top text-xs">{loc.storeName}</td>
      <td className="border-b border-card-border px-3 py-2 align-top text-xs text-muted" dir="ltr">
        {new Date(order.createdAt).toLocaleString("en-GB")}
      </td>
    </tr>
  );
}

export function CaptainOrdersReportModal({ captain, open, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const captainId = captain?.id ?? null;
  const stats = useCaptainStats(captainId, { enabled: open && Boolean(captainId) });

  const [f, setF] = useState({
    page: 1,
    pageSize: 15,
    from: "",
    to: "",
    q: "",
    area: "",
    status: "",
  });

  useEffect(() => {
    if (open && captain) {
      setF((prev) => ({ ...prev, page: 1 }));
    }
  }, [open, captain?.id]);

  const queryParams = useMemo(() => buildQueryParams(f), [f]);
  const orders = useCaptainOrdersReport(captainId, queryParams, { enabled: open && Boolean(captainId) });

  const title = captain
    ? t("captains.report.titleWithName", { name: captainUserNameDisplay(captain, lang) })
    : t("captains.report.title");

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={t("captains.report.description")}
      className="max-w-4xl max-h-[90vh] overflow-y-auto"
    >
      <div className="grid gap-6">
        <div className="grid gap-3 rounded-xl border border-card-border bg-background/50 p-4 text-sm">
          <p className="text-xs font-medium text-muted">{t("captains.report.quickSummary")}</p>
          {stats.isLoading ? (
            <LoadingBlock compact />
          ) : stats.isError ? (
            <InlineAlert variant="error">{(stats.error as Error).message}</InlineAlert>
          ) : stats.data ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatTile label={t("captains.stats.deliveredOrders")} value={stats.data.ordersDelivered} />
              <StatTile label={t("captains.report.activeWithCaptain")} value={stats.data.activeOrders} />
              <div className="sm:col-span-1">
                <div className="text-xs text-muted">{t("captains.stats.lastLocation")}</div>
                {stats.data.lastLocation ? (
                  <div dir="ltr" className="font-mono text-xs text-muted">
                    {stats.data.lastLocation.latitude.toFixed(5)}, {stats.data.lastLocation.longitude.toFixed(5)}
                  </div>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 rounded-xl border border-card-border p-4">
          <p className="text-sm font-medium">{t("captains.report.filtersTitle")}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="grid gap-1">
              <Label className="text-xs text-muted">{t("common.fromDate")}</Label>
              <Input
                type="date"
                className={FORM_CONTROL_CLASS}
                value={f.from}
                onChange={(e) => setF((p) => ({ ...p, page: 1, from: e.target.value }))}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs text-muted">{t("common.toDate")}</Label>
              <Input
                type="date"
                className={FORM_CONTROL_CLASS}
                value={f.to}
                onChange={(e) => setF((p) => ({ ...p, page: 1, to: e.target.value }))}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs text-muted">{t("captains.report.areaLabel")}</Label>
              <Input
                placeholder={t("captains.report.areaPlaceholder")}
                value={f.area}
                onChange={(e) => setF((p) => ({ ...p, page: 1, area: e.target.value }))}
              />
            </div>
            <div className="grid gap-1 sm:col-span-2">
              <Label className="text-xs text-muted">{t("captains.report.searchLabel")}</Label>
              <Input
                dir="ltr"
                className="text-left"
                placeholder={t("common.search")}
                value={f.q}
                onChange={(e) => setF((p) => ({ ...p, page: 1, q: e.target.value }))}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs text-muted">{t("orders.list.statusLabel")}</Label>
              <select
                className={FORM_CONTROL_CLASS}
                value={f.status}
                onChange={(e) => setF((p) => ({ ...p, page: 1, status: e.target.value }))}
              >
                {ORDER_STATUS_FILTER_VALUES.map((v) => (
                  <option key={v || "all"} value={v}>
                    {v === "" ? t("orders.list.statusAll") : t(`orderStatus.${v}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <TableShell className="rounded-xl">
          {orders.isLoading ? (
            <LoadingBlock compact message={t("captains.report.loadingOrders")} />
          ) : orders.isError ? (
            <InlineAlert variant="error" className="m-3">
              {(orders.error as Error).message}
            </InlineAlert>
          ) : (
            <>
              <table className="w-full min-w-[760px] border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="bg-muted/30 text-muted">
                    <th className="border-b border-card-border px-3 py-2 text-right font-medium">{t("orders.list.colOrder")}</th>
                    <th className="border-b border-card-border px-3 py-2 text-right font-medium">{t("orders.list.colStatus")}</th>
                    <th className="border-b border-card-border px-3 py-2 text-right font-medium">{t("orders.list.colCustomer")}</th>
                    <th className="border-b border-card-border px-3 py-2 text-right font-medium">{t("orders.list.colArea")}</th>
                    <th className="border-b border-card-border px-3 py-2 text-right font-medium">{t("orders.list.colStore")}</th>
                    <th className="border-b border-card-border px-3 py-2 text-right font-medium">{t("orders.list.colDate")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(orders.data?.items ?? []).map((o) => (
                    <CaptainReportOrderRow key={o.id} order={o} />
                  ))}
                </tbody>
              </table>
              {orders.data && orders.data.items.length === 0 ? (
                <div className="p-3">
                  <EmptyState title={t("captains.report.emptyTitle")} description={t("captains.report.emptyDescription")} />
                </div>
              ) : null}
              {orders.data ? (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-card-border px-3 py-2 text-xs text-muted">
                  <span>
                    {t("captains.report.paginationSummary", {
                      total: orders.data.total,
                      page: f.page,
                      pages: Math.max(1, Math.ceil(orders.data.total / f.pageSize)),
                    })}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={f.page <= 1}
                      onClick={() => setF((p) => ({ ...p, page: Math.max(1, p.page - 1) }))}
                    >
                      {t("common.previous")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={f.page * f.pageSize >= orders.data.total}
                      onClick={() => setF((p) => ({ ...p, page: p.page + 1 }))}
                    >
                      {t("common.next")}
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </TableShell>

        <div className="flex justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("common.close")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
