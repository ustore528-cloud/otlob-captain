import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FORM_CONTROL_CLASS } from "@/components/ui/form-field-classes";
import { InlineAlert } from "@/components/ui/inline-alert";
import { LoadingBlock } from "@/components/ui/loading-block";
import { StatTile } from "@/components/ui/stat-tile";
import { TableShell } from "@/components/ui/table-shell";
import { useCaptains } from "@/hooks/captains/use-captains";
import { useStores } from "@/hooks/stores/use-stores";
import { queryKeys } from "@/lib/api/query-keys";
import { api } from "@/lib/api/singleton";
import { useAuthStore } from "@/stores/auth-store";
import { ApiError } from "@/lib/api/http";
import { Navigate } from "react-router-dom";
import { canAccessFinancePage } from "@/lib/rbac-roles";
import { downloadOrdersHistoryCsv } from "@/features/reports/utils/orders-history-csv-export";
import { tableDateLocale } from "@/i18n/date-locale";
import { toast } from "sonner";

const PAGE_SIZE = 20;
const MS_7D = 7 * 24 * 60 * 60 * 1000;
const ILS_LABEL = "₪ ILS";

function defaultRangeUtc() {
  const to = new Date();
  const from = new Date(to.getTime() - MS_7D);
  return { from: from.toISOString(), to: to.toISOString() };
}

function toLocalValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromIsoToLocal(iso: string) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return toLocalValue(new Date(t));
}

function localToUtc(iso: string) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  return new Date(t).toISOString();
}

type RangeErrCode = "INVALID" | "ORDER" | "MAX" | null;

export function ReportsPageView() {
  const { t, i18n } = useTranslation();
  const dateLocale = tableDateLocale(i18n.resolvedLanguage ?? i18n.language);
  const role = useAuthStore((s) => s.user?.role);
  const token = useAuthStore((s) => s.token);
  const [fromUtc, setFromUtc] = useState(() => defaultRangeUtc().from);
  const [toUtc, setToUtc] = useState(() => defaultRangeUtc().to);
  const [draftFrom, setDraftFrom] = useState(() => fromIsoToLocal(defaultRangeUtc().from));
  const [draftTo, setDraftTo] = useState(() => fromIsoToLocal(defaultRangeUtc().to));
  const [rangeError, setRangeError] = useState<RangeErrCode>(null);

  const [captainId, setCaptainId] = useState<string | null>(null);
  const [prepaidPage, setPrepaidPage] = useState(1);
  const [deliveredPage, setDeliveredPage] = useState(1);
  const [ordersHistoryPage, setOrdersHistoryPage] = useState(1);
  const [ordersCaptainId, setOrdersCaptainId] = useState<string>("");
  const [ordersStoreId, setOrdersStoreId] = useState<string>("");
  const [ordersStatus, setOrdersStatus] = useState<string>("");
  const [exportingOrdersCsv, setExportingOrdersCsv] = useState(false);

  const captainsQ = useCaptains({ page: 1, pageSize: 200 }, { enabled: Boolean(token) });
  const storesQ = useStores(1, 200, { enabled: Boolean(token) });

  useEffect(() => {
    const items = captainsQ.data?.items ?? [];
    if (items.length && !captainId) {
      setCaptainId(items[0]!.id);
    }
  }, [captainsQ.data?.items, captainId]);

  const applyRange = () => {
    setRangeError(null);
    const f = localToUtc(draftFrom);
    const toIso = localToUtc(draftTo);
    if (!f || !toIso) {
      setRangeError("INVALID");
      return;
    }
    if (new Date(f).getTime() > new Date(toIso).getTime()) {
      setRangeError("ORDER");
      return;
    }
    if (new Date(toIso).getTime() - new Date(f).getTime() > 90 * 24 * 60 * 60 * 1000) {
      setRangeError("MAX");
      return;
    }
    setFromUtc(f);
    setToUtc(t);
    setPrepaidPage(1);
    setDeliveredPage(1);
    setOrdersHistoryPage(1);
  };

  const recon = useQuery({
    queryKey: queryKeys.reports.reconciliation(fromUtc, toUtc),
    queryFn: () => api.reports.getReconciliationSummary({ from: fromUtc, to: toUtc }),
    enabled: Boolean(token),
  });

  const prepaid = useQuery({
    queryKey: queryKeys.reports.prepaidBook(captainId ?? "", fromUtc, toUtc, prepaidPage),
    queryFn: () =>
      api.captains.prepaidTransactions(captainId!, {
        page: prepaidPage,
        pageSize: PAGE_SIZE,
        from: fromUtc,
        to: toUtc,
      }),
    enabled: Boolean(token && captainId),
  });

  const delivered = useQuery({
    queryKey: queryKeys.reports.deliveredCommissions(fromUtc, toUtc, deliveredPage),
    queryFn: () =>
      api.reports.getDeliveredCommissionsPage({
        from: fromUtc,
        to: toUtc,
        page: deliveredPage,
        pageSize: PAGE_SIZE,
      }),
    enabled: Boolean(token),
  });

  const ordersHistory = useQuery({
    queryKey: queryKeys.reports.ordersHistory(
      fromUtc,
      toUtc,
      ordersHistoryPage,
      PAGE_SIZE,
      ordersCaptainId || undefined,
      ordersStoreId || undefined,
      ordersStatus || undefined,
    ),
    queryFn: () =>
      api.reports.getOrdersHistoryPage({
        from: fromUtc,
        to: toUtc,
        page: ordersHistoryPage,
        pageSize: PAGE_SIZE,
        captainId: ordersCaptainId || undefined,
        storeId: ordersStoreId || undefined,
        status: ordersStatus || undefined,
      }),
    enabled: Boolean(token),
  });

  async function exportOrdersHistoryCsv() {
    if (!token) return;
    setExportingOrdersCsv(true);
    try {
      const first = await api.reports.getOrdersHistoryPage({
        from: fromUtc,
        to: toUtc,
        page: 1,
        pageSize: 100,
        captainId: ordersCaptainId || undefined,
        storeId: ordersStoreId || undefined,
        status: ordersStatus || undefined,
      });
      let allRows = [...first.rows];
      for (let page = 2; page <= first.totalPages; page += 1) {
        const next = await api.reports.getOrdersHistoryPage({
          from: fromUtc,
          to: toUtc,
          page,
          pageSize: 100,
          captainId: ordersCaptainId || undefined,
          storeId: ordersStoreId || undefined,
          status: ordersStatus || undefined,
        });
        allRows = allRows.concat(next.rows);
      }
      const stamp = new Date().toISOString().slice(0, 10);
      downloadOrdersHistoryCsv(allRows, `orders-history-${stamp}.csv`, t, dateLocale);
      toast.success(t("reports.exportSuccess"));
    } catch (error) {
      const message = error instanceof ApiError ? error.message : t("reports.exportFail");
      toast.error(message);
    } finally {
      setExportingOrdersCsv(false);
    }
  }

  if (!canAccessFinancePage(role)) {
    return <Navigate to="/" replace />;
  }

  const err = (e: unknown) => (e instanceof ApiError ? e.message : (e as Error).message);

  return (
    <div className="grid gap-8 sm:gap-10">
      <PageHeader title={t("reports.pageTitle")} divider description={t("reports.pageDesc")} />

      <Card className="shadow-sm ring-1 ring-card-border/80">
        <CardHeader>
          <CardTitle className="text-base">{t("reports.rangeCardTitle")}</CardTitle>
          <CardDescription>{t("reports.rangeCardDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-[12rem] flex-col gap-1 text-sm">
              <span className="text-muted">{t("reports.fromLocal")}</span>
              <input
                type="datetime-local"
                className={FORM_CONTROL_CLASS}
                value={draftFrom}
                onChange={(e) => setDraftFrom(e.target.value)}
              />
            </label>
            <label className="flex min-w-[12rem] flex-col gap-1 text-sm">
              <span className="text-muted">{t("reports.toLocal")}</span>
              <input
                type="datetime-local"
                className={FORM_CONTROL_CLASS}
                value={draftTo}
                onChange={(e) => setDraftTo(e.target.value)}
              />
            </label>
            <Button type="button" size="sm" onClick={applyRange}>
              {t("reports.applyRange")}
            </Button>
          </div>
          {rangeError ? <InlineAlert variant="error">{t(`reports.rangeError.${rangeError}`)}</InlineAlert> : null}
        </CardContent>
      </Card>

      <Card className="shadow-sm ring-1 ring-card-border/80">
        <CardHeader>
          <CardTitle className="text-base">{t("reports.reconTitle")}</CardTitle>
          <CardDescription>{t("reports.reconDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {recon.isLoading ? <LoadingBlock message={t("reports.loadingSummary")} compact /> : null}
          {recon.isError ? <InlineAlert variant="error">{err(recon.error)}</InlineAlert> : null}
          {recon.data ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <StatTile label={t("reports.reconStatDeliverLedger")} value={recon.data.deliverLedgerVsPrepaid.ledgerLineCount} />
              <StatTile
                label={t("reports.reconStatMissingPrepaid")}
                value={recon.data.deliverLedgerVsPrepaid.missingPrepaidMirrorCount}
                tone="caution"
              />
              <StatTile
                label={t("reports.reconStatDeliverMismatch")}
                value={recon.data.deliverLedgerVsPrepaid.amountMismatchCount}
                tone="critical"
              />
              <StatTile label={t("reports.reconStatChargeRows")} value={recon.data.chargeAdjustAlignment.cbtRowCount} />
              <StatTile
                label={t("reports.reconStatMissingLedger")}
                value={recon.data.chargeAdjustAlignment.missingOrMismatchedLedgerCount}
                tone="caution"
              />
              <StatTile
                label={t("reports.reconStatChargeMismatch")}
                value={recon.data.chargeAdjustAlignment.amountMismatchCount}
                tone="critical"
              />
              <StatTile
                label={t("reports.reconStatOrphanLedger")}
                value={recon.data.chargeAdjustAlignment.orphanLedgerRowsWithoutCbtCount}
                tone="caution"
                className="sm:col-span-2 lg:col-span-3"
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="shadow-sm ring-1 ring-card-border/80">
        <CardHeader>
          <CardTitle className="text-base">{t("reports.prepaidTitle")}</CardTitle>
          <CardDescription>{t("reports.prepaidDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex max-w-md flex-col gap-1 text-sm">
            <span className="text-muted">{t("reports.captain")}</span>
            <select
              className={FORM_CONTROL_CLASS}
              value={captainId ?? ""}
              onChange={(e) => {
                setCaptainId(e.target.value || null);
                setPrepaidPage(1);
              }}
              disabled={captainsQ.isLoading || !captainsQ.data?.items.length}
            >
              {(captainsQ.data?.items ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.user.fullName} — {c.area}
                </option>
              ))}
            </select>
          </label>
          {prepaid.isLoading ? <LoadingBlock message={t("reports.loadingPrepaid")} compact /> : null}
          {prepaid.isError ? <InlineAlert variant="error">{err(prepaid.error)}</InlineAlert> : null}
          {!captainsQ.isLoading && !captainsQ.data?.items.length ? (
            <InlineAlert variant="warning">{t("reports.noCaptains")}</InlineAlert>
          ) : null}
          {prepaid.data ? (
            <TableShell>
              <table className="w-full min-w-[720px] border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="bg-muted/30 text-muted">
                    <th className="border-b border-card-border px-3 py-2.5 text-right text-xs font-medium">{t("reports.colTime")}</th>
                    <th className="border-b border-card-border px-3 py-2.5 text-right text-xs font-medium">{t("reports.colType")}</th>
                    <th className="border-b border-card-border px-3 py-2.5 text-left text-xs font-medium">{t("reports.colAmount")}</th>
                    <th className="border-b border-card-border px-3 py-2.5 text-left text-xs font-medium">{t("reports.colBalanceAfter")}</th>
                    <th className="border-b border-card-border px-3 py-2.5 text-right text-xs font-medium">{t("reports.colOrder")}</th>
                  </tr>
                </thead>
                <tbody>
                  {prepaid.data.items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-0">
                        <EmptyState title={t("reports.prepaidEmpty")} className="border-0 py-6 shadow-none" />
                      </td>
                    </tr>
                  ) : (
                    prepaid.data.items.map((r) => (
                      <tr key={r.id} className="transition hover:bg-accent/50">
                        <td className="border-b border-card-border px-3 py-2.5 text-xs" dir="ltr">
                          {new Date(r.createdAt).toLocaleString(dateLocale, { hour12: false })}
                        </td>
                        <td className="border-b border-card-border px-3 py-2.5">{r.type}</td>
                        <td className="border-b border-card-border px-3 py-2.5 font-mono" dir="ltr">
                          {r.amount}
                        </td>
                        <td className="border-b border-card-border px-3 py-2.5 font-mono" dir="ltr">
                          {r.balanceAfter}
                        </td>
                        <td className="border-b border-card-border px-3 py-2.5 text-xs" dir="ltr">
                          {r.orderId ?? "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </TableShell>
          ) : null}
          {prepaid.data && Math.ceil(prepaid.data.total / PAGE_SIZE) > 1 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm sm:flex-nowrap">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={prepaidPage <= 1}
                onClick={() => setPrepaidPage((p) => Math.max(1, p - 1))}
              >
                {t("reports.prev")}
              </Button>
              <span className="text-muted">
                {t("reports.pageOf", { page: prepaidPage, total: prepaid.data.total })}
              </span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={prepaidPage * PAGE_SIZE >= prepaid.data.total}
                onClick={() => setPrepaidPage((p) => p + 1)}
              >
                {t("reports.next")}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="shadow-sm ring-1 ring-card-border/80">
        <CardHeader>
          <CardTitle className="text-base">{t("reports.deliveredTitle")}</CardTitle>
          <CardDescription>{t("reports.deliveredDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {delivered.isLoading ? <LoadingBlock message={t("reports.loadingDelivered")} compact /> : null}
          {delivered.isError ? <InlineAlert variant="error">{err(delivered.error)}</InlineAlert> : null}
          {delivered.data ? (
            <TableShell>
              <table className="w-full min-w-[880px] border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="bg-muted/30 text-muted">
                    <th className="border-b border-card-border px-3 py-2.5 text-right text-xs font-medium">{t("reports.colLineTime")}</th>
                    <th className="border-b border-card-border px-3 py-2.5 text-right text-xs font-medium">{t("reports.colOrderNum")}</th>
                    <th className="border-b border-card-border px-3 py-2.5 text-right text-xs font-medium">{t("reports.colStore")}</th>
                    <th className="border-b border-card-border px-3 py-2.5 text-right text-xs font-medium">{t("reports.colCaptain")}</th>
                    <th className="border-b border-card-border px-3 py-2.5 text-left text-xs font-medium">{t("reports.colDeliveryFee")}</th>
                    <th className="border-b border-card-border px-3 py-2.5 text-left text-xs font-medium">{t("reports.colCommission")}</th>
                  </tr>
                </thead>
                <tbody>
                  {delivered.data.items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-0">
                        <EmptyState title={t("reports.deliveredEmpty")} className="border-0 py-6 shadow-none" />
                      </td>
                    </tr>
                  ) : (
                    delivered.data.items.map((r) => (
                      <tr key={r.ledgerEntryId} className="transition hover:bg-accent/50">
                        <td className="border-b border-card-border px-3 py-2.5 text-xs" dir="ltr">
                          {new Date(r.ledgerCreatedAt).toLocaleString(dateLocale, { hour12: false })}
                        </td>
                        <td className="border-b border-card-border px-3 py-2.5 font-mono text-xs" dir="ltr">
                          {r.orderNumber}
                        </td>
                        <td className="border-b border-card-border px-3 py-2.5">
                          {r.storeName} ({r.storeArea})
                        </td>
                        <td className="border-b border-card-border px-3 py-2.5">{r.captainName ?? "—"}</td>
                        <td className="border-b border-card-border px-3 py-2.5 font-mono" dir="ltr">
                          {r.deliveryFee} {r.currency === "ILS" ? ILS_LABEL : r.currency}
                        </td>
                        <td className="border-b border-card-border px-3 py-2.5 font-mono" dir="ltr">
                          {r.commissionAmount} {r.currency === "ILS" ? ILS_LABEL : r.currency}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </TableShell>
          ) : null}
          {delivered.data && Math.ceil(delivered.data.total / PAGE_SIZE) > 1 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm sm:flex-nowrap">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={deliveredPage <= 1}
                onClick={() => setDeliveredPage((p) => Math.max(1, p - 1))}
              >
                {t("reports.prev")}
              </Button>
              <span className="text-muted">
                {t("reports.pageOf", { page: deliveredPage, total: delivered.data.total })}
              </span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={deliveredPage * PAGE_SIZE >= delivered.data.total}
                onClick={() => setDeliveredPage((p) => p + 1)}
              >
                {t("reports.next")}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="shadow-sm ring-1 ring-card-border/80">
        <CardHeader>
          <CardTitle className="text-base">
            {t("reports.historyTitle")}{" "}
            <span className="ms-2 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {t("reports.historyBadge")}
            </span>
          </CardTitle>
          <CardDescription>{t("reports.historyDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-[14rem] flex-col gap-1 text-sm">
              <span className="text-muted">{t("reports.filterCaptain")}</span>
              <select
                className={FORM_CONTROL_CLASS}
                value={ordersCaptainId}
                onChange={(e) => {
                  setOrdersCaptainId(e.target.value);
                  setOrdersHistoryPage(1);
                }}
              >
                <option value="">{t("reports.filterAll")}</option>
                {(captainsQ.data?.items ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.user.fullName} — {c.area}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-[14rem] flex-col gap-1 text-sm">
              <span className="text-muted">{t("reports.filterStore")}</span>
              <select
                className={FORM_CONTROL_CLASS}
                value={ordersStoreId}
                onChange={(e) => {
                  setOrdersStoreId(e.target.value);
                  setOrdersHistoryPage(1);
                }}
              >
                <option value="">{t("reports.filterAll")}</option>
                {(storesQ.data?.items ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.area}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-[12rem] flex-col gap-1 text-sm">
              <span className="text-muted">{t("reports.filterStatus")}</span>
              <select
                className={FORM_CONTROL_CLASS}
                value={ordersStatus}
                onChange={(e) => {
                  setOrdersStatus(e.target.value);
                  setOrdersHistoryPage(1);
                }}
              >
                <option value="">{t("reports.filterAll")}</option>
                <option value="PENDING">PENDING</option>
                <option value="CONFIRMED">CONFIRMED</option>
                <option value="ASSIGNED">ASSIGNED</option>
                <option value="ACCEPTED">ACCEPTED</option>
                <option value="PICKED_UP">PICKED_UP</option>
                <option value="IN_TRANSIT">IN_TRANSIT</option>
                <option value="DELIVERED">DELIVERED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </label>
            <Button type="button" variant="secondary" size="sm" disabled={exportingOrdersCsv} onClick={() => void exportOrdersHistoryCsv()}>
              {exportingOrdersCsv ? t("reports.exporting") : t("reports.exportCsv")}
            </Button>
          </div>
          {ordersHistory.isLoading ? <LoadingBlock message={t("reports.loadingHistory")} compact /> : null}
          {ordersHistory.isError ? <InlineAlert variant="error">{err(ordersHistory.error)}</InlineAlert> : null}
          {ordersHistory.data?.totals ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile label={t("reports.totStore")} value={ordersHistory.data.totals.totalStoreAmount} />
              <StatTile label={t("reports.totDelivery")} value={ordersHistory.data.totals.totalDeliveryFees} />
              <StatTile label={t("reports.totCustomer")} value={ordersHistory.data.totals.totalCustomerCollection} />
              <StatTile label={t("reports.totProfit")} value={ordersHistory.data.totals.totalProfitOrCommission} />
            </div>
          ) : null}
          {ordersHistory.data ? (
            <TableShell>
              <table className="w-full min-w-[1400px] border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="bg-muted/30 text-muted">
                    <th className="border-b border-card-border px-3 py-2.5 text-right text-xs font-medium">{t("reports.thOrderNumber")}</th>
                    <th className="border-b border-card-border px-3 py-2.5 text-right text-xs font-medium">{t("reports.thStore")}</th>
                    <th className="border-b border-card-border px-3 py-2.5 text-right text-xs font-medium">{t("reports.thCaptain")}</th>
                    <th className="border-b border-card-border px-3 py-2.5 text-right text-xs font-medium">{t("reports.thCaptainPhone")}</th>
                    <th className="border-b border-card-border px-3 py-2.5 text-right text-xs font-medium">{t("reports.thCustomer")}</th>
                    <th className="border-b border-card-border px-3 py-2.5 text-right text-xs font-medium">{t("reports.thStatus")}</th>
                    <th className="border-b border-card-border px-3 py-2.5 text-right text-xs font-medium">{t("reports.thAssigned")}</th>
                    <th className="border-b border-card-border px-3 py-2.5 text-right text-xs font-medium">{t("reports.thAccepted")}</th>
                    <th className="border-b border-card-border px-3 py-2.5 text-right text-xs font-medium">{t("reports.thPickup")}</th>
                    <th className="border-b border-card-border px-3 py-2.5 text-right text-xs font-medium">{t("reports.thDelivery")}</th>
                    <th className="border-b border-card-border px-3 py-2.5 text-left text-xs font-medium">{t("reports.thStoreAmount")}</th>
                    <th className="border-b border-card-border px-3 py-2.5 text-left text-xs font-medium">{t("reports.thDeliveryFee")}</th>
                    <th className="border-b border-card-border px-3 py-2.5 text-left text-xs font-medium">{t("reports.thCustomerCollection")}</th>
                    <th className="border-b border-card-border px-3 py-2.5 text-left text-xs font-medium">{t("reports.thProfit")}</th>
                  </tr>
                </thead>
                <tbody>
                  {ordersHistory.data.rows.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="p-0">
                        <EmptyState title={t("reports.historyEmpty")} className="border-0 py-6 shadow-none" />
                      </td>
                    </tr>
                  ) : (
                    ordersHistory.data.rows.map((r, idx) => (
                      <tr key={`${r.orderNumber}-${idx}`} className="transition hover:bg-accent/50">
                        <td className="border-b border-card-border px-3 py-2.5 font-mono text-xs" dir="ltr">{r.orderNumber}</td>
                        <td className="border-b border-card-border px-3 py-2.5">{r.storeName}</td>
                        <td className="border-b border-card-border px-3 py-2.5">{r.captainName ?? "—"}</td>
                        <td className="border-b border-card-border px-3 py-2.5" dir="ltr">{r.captainPhone ?? "—"}</td>
                        <td className="border-b border-card-border px-3 py-2.5">{r.customerName ?? "—"}</td>
                        <td className="border-b border-card-border px-3 py-2.5">{r.status}</td>
                        <td className="border-b border-card-border px-3 py-2.5 text-xs" dir="ltr">
                          {r.assignedAt ? new Date(r.assignedAt).toLocaleString(dateLocale, { hour12: false }) : t("common.none")}
                        </td>
                        <td className="border-b border-card-border px-3 py-2.5 text-xs" dir="ltr">
                          {r.acceptedAt ? new Date(r.acceptedAt).toLocaleString(dateLocale, { hour12: false }) : t("common.none")}
                        </td>
                        <td className="border-b border-card-border px-3 py-2.5 text-xs text-muted" dir="ltr">
                          {r.pickupAt ? new Date(r.pickupAt).toLocaleString(dateLocale, { hour12: false }) : t("common.notRecorded")}
                        </td>
                        <td className="border-b border-card-border px-3 py-2.5 text-xs" dir="ltr">
                          {r.deliveredAt ? new Date(r.deliveredAt).toLocaleString(dateLocale, { hour12: false }) : t("common.none")}
                        </td>
                        <td className="border-b border-card-border px-3 py-2.5 font-mono" dir="ltr">{r.storeAmount.toFixed(2)}</td>
                        <td className="border-b border-card-border px-3 py-2.5 font-mono" dir="ltr">{r.deliveryFee.toFixed(2)}</td>
                        <td className="border-b border-card-border px-3 py-2.5 font-mono" dir="ltr">{r.customerCollectionAmount.toFixed(2)}</td>
                        <td className="border-b border-card-border px-3 py-2.5 font-mono" dir="ltr">{r.profitOrCommission.toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </TableShell>
          ) : null}
          {ordersHistory.data && ordersHistory.data.totalPages > 1 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm sm:flex-nowrap">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={ordersHistoryPage <= 1}
                onClick={() => setOrdersHistoryPage((p) => Math.max(1, p - 1))}
              >
                {t("reports.prev")}
              </Button>
              <span className="text-muted">
                {t("reports.pageOf", { page: ordersHistoryPage, total: ordersHistory.data.total })}
              </span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={ordersHistoryPage >= ordersHistory.data.totalPages}
                onClick={() => setOrdersHistoryPage((p) => p + 1)}
              >
                {t("reports.next")}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
