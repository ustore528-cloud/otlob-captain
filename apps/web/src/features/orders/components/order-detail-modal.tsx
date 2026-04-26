import { useTranslation } from "react-i18next";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { LoadingBlock } from "@/components/ui/loading-block";
import { orderStatusBadgeVariant, orderStatusLabel } from "@/lib/order-status";
import { storeSubscriptionLabel } from "@/lib/store-subscription-label";
import { tableDateLocale } from "@/i18n/date-locale";
import type { OrderDetail, StoreSubscriptionType } from "@/types/api";
import { OrderFinancialStrip } from "@/features/orders/components/order-financial-strip";

function formatInstant(iso: string | null | undefined, notRecorded: string, dateLocale: string): string {
  if (!iso || !String(iso).trim()) return notRecorded;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return notRecorded;
  return new Date(t).toLocaleString(dateLocale, { hour12: false });
}

type Props = {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  error: Error | null;
  order: OrderDetail | null | undefined;
};

export function OrderDetailModal({ open, onClose, loading, error, order }: Props) {
  const { t, i18n } = useTranslation();
  const dateLocale = tableDateLocale(i18n.resolvedLanguage ?? i18n.language);
  const notRecorded = t("common.notRecorded");
  const store = order?.store;

  return (
    <Modal open={open} onClose={onClose} title={t("orders.detailModal.title")} description={t("orders.detailModal.description")}>
      <div className="grid gap-4">
        {loading ? <LoadingBlock compact /> : null}
        {error ? <InlineAlert variant="error">{error.message}</InlineAlert> : null}
        {!loading && !error && order ? (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted">{t("orders.detailModal.orderLabel")}</span>
              <span className="font-mono font-medium text-foreground" dir="ltr">
                {order.orderNumber}
              </span>
              <Badge variant={orderStatusBadgeVariant(order.status)}>{orderStatusLabel(order.status)}</Badge>
            </div>

            <div className="grid gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground" dir="ltr">
                {t("financial.sectionBreakdown")}
              </h3>
              <OrderFinancialStrip
                amount={order.amount}
                cashCollection={order.cashCollection}
                deliveryFee={order.deliveryFee}
                breakdown={order.financialBreakdown}
                variant="modal"
              />
              <div className="flex flex-wrap justify-between gap-2 rounded-md border border-dashed border-card-border px-3 py-2 text-sm" dir="ltr">
                <span className="text-muted-foreground">{t("financial.profitCommission")}</span>
                <span className="font-mono font-medium">
                  {order.commissionEstimate != null && order.commissionEstimate !== "" ? order.commissionEstimate : "—"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground" dir="ltr">
                {t("orders.detailModal.paymentLabel")}{" "}
                <span className="font-medium text-foreground">
                  {order.financialBreakdown?.isCashOnDelivery ? t("financial.paymentCod") : t("financial.paymentNotCod")}
                </span>
              </p>
            </div>

            <div className="grid gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground" dir="ltr">
                {t("timestamps.section")}
              </h3>
              <dl className="grid gap-2 text-sm" dir="ltr">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{t("timestamps.assigned")}</dt>
                  <dd className="font-mono text-right">{formatInstant(order.assignedAt ?? null, notRecorded, dateLocale)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{t("timestamps.pickup")}</dt>
                  <dd className="font-mono text-right">{formatInstant(order.pickedUpAt ?? null, notRecorded, dateLocale)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{t("timestamps.delivery")}</dt>
                  <dd className="font-mono text-right">{formatInstant(order.deliveredAt ?? null, notRecorded, dateLocale)}</dd>
                </div>
              </dl>
            </div>

            <div className="grid gap-2 text-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("orders.detailModal.customerAddresses")}
              </h3>
              <div>
                <span className="font-medium">{order.customerName}</span>
                <span className="mx-2 text-muted">·</span>
                <span dir="ltr" className="font-mono text-xs">
                  {order.customerPhone}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                <div>
                  {t("orders.detailModal.pickup")}: {order.pickupAddress}
                </div>
                <div className="mt-0.5">
                  {t("orders.detailModal.dropoff")}: {order.dropoffAddress}
                </div>
              </div>
            </div>

            {store ? (
              <div className="grid gap-3 rounded-lg border border-card-border bg-background/70 p-3 text-sm">
                <div className="font-medium text-foreground">{store.name}</div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted">{t("orders.detailModal.subscriptionType")}</span>
                  <Badge variant="muted">{storeSubscriptionLabel(store.subscriptionType as StoreSubscriptionType)}</Badge>
                  <span className="font-mono text-xs text-muted" dir="ltr">
                    {store.subscriptionType}
                  </span>
                </div>
                <div>
                  <div className="text-xs text-muted">{t("orders.detailModal.supervisor")}</div>
                  {store.supervisorUser ? (
                    <div className="mt-1">
                      <div className="font-medium">{store.supervisorUser.fullName}</div>
                      <div className="text-xs text-muted" dir="ltr">
                        {store.supervisorUser.phone}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1 text-xs text-muted">{t("orders.detailModal.noSupervisor")}</div>
                  )}
                </div>
                <div>
                  <div className="text-xs text-muted">{t("orders.detailModal.primaryRegion")}</div>
                  {store.primaryRegion ? (
                    <div className="mt-1">
                      <div className="font-medium">{store.primaryRegion.name}</div>
                      <div className="text-xs text-muted" dir="ltr">
                        {store.primaryRegion.code}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1 text-xs text-muted">{t("orders.detailModal.regionUnset")}</div>
                  )}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
        {!loading && !error && !order ? (
          <EmptyState title={t("orders.detailModal.empty")} description={t("orders.detailModal.emptyDesc")} className="py-6" />
        ) : null}
        <div className="flex justify-end pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("common.close")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
