import { formatOrderDisplayLabel } from "@captain/shared";
import { useTranslation } from "react-i18next";
import type { OrderListItem } from "@/types/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLocalizedOrderListItem } from "@/i18n/use-localized-order-display";

type Props = {
  orders: OrderListItem[];
  pendingOrderIds: Set<string>;
  onManual: (order: OrderListItem) => void;
  onResend: (order: OrderListItem) => void;
  onDragState: (orderId: string | null) => void;
};

function urgencyTone(order: OrderListItem): string {
  const ageMs = Date.now() - Date.parse(order.createdAt);
  if (ageMs > 20 * 60 * 1000) return "bg-red-100 text-red-700";
  if (ageMs > 10 * 60 * 1000) return "bg-amber-100 text-amber-700";
  return "bg-emerald-100 text-emerald-700";
}

function urgencyLabel(order: OrderListItem, t: (k: string) => string): string {
  const ageMs = Date.now() - Date.parse(order.createdAt);
  if (ageMs > 20 * 60 * 1000) return t("distribution.urgency.urgent");
  if (ageMs > 10 * 60 * 1000) return t("distribution.urgency.delayed");
  return t("distribution.urgency.normal");
}

function OrdersPanelArticle({
  order,
  pending,
  t,
  onManual,
  onResend,
  onDragState,
}: {
  order: OrderListItem;
  pending: boolean;
  t: (k: string) => string;
  onManual: (order: OrderListItem) => void;
  onResend: (order: OrderListItem) => void;
  onDragState: (orderId: string | null) => void;
}) {
  const loc = useLocalizedOrderListItem(order);
  return (
    <article
      draggable={!pending}
      onDragStart={(e) => {
        onDragState(order.id);
        e.dataTransfer.setData("application/x-order-id", order.id);
        e.dataTransfer.setData("text/plain", order.id);
        e.dataTransfer.effectAllowed = "copy";
      }}
      onDragEnd={() => onDragState(null)}
      className="rounded-xl border border-card-border bg-card p-2"
    >
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs font-semibold tabular-nums text-primary" dir="ltr" title={order.orderNumber}>
          {formatOrderDisplayLabel(order.displayOrderNo ?? null, order.orderNumber)}
        </p>
        <Badge className={cn("text-[10px]", urgencyTone(order))}>{urgencyLabel(order, t)}</Badge>
      </div>
      <p className="text-xs font-semibold">{loc.customerName}</p>
      <p className="line-clamp-1 text-[11px] text-muted">{loc.pickupAddress}</p>
      <p className="line-clamp-1 text-[11px] text-muted">{loc.dropoffAddress}</p>
      <p className="mt-1 text-[10px] text-muted">{new Date(order.createdAt).toLocaleTimeString("en-GB", { hour12: false })}</p>
      <div className="mt-2 flex gap-1">
        <Button size="sm" variant="secondary" className="h-7 px-2 text-[10px]" onClick={() => onManual(order)}>
          {t("distribution.ordersPanel.manualAssign")}
        </Button>
        <Button size="sm" className="h-7 px-2 text-[10px]" onClick={() => onResend(order)}>
          {t("distribution.ordersPanel.redistribute")}
        </Button>
      </div>
    </article>
  );
}

export function OrdersPanel({ orders, pendingOrderIds, onManual, onResend, onDragState }: Props) {
  const { t } = useTranslation();
  return (
    <aside className="h-[calc(100vh-210px)] overflow-y-auto rounded-2xl border border-card-border bg-white p-3 shadow-sm">
      <h3 className="mb-1 text-sm font-semibold">طلبات غير مسندة للإسناد اليدوي</h3>
      <p className="mb-3 text-xs text-muted">{t("distribution.ordersPanel.newOrdersCount", { count: orders.length })}</p>
      <div className="space-y-2">
        {orders.map((order) => (
          <OrdersPanelArticle
            key={order.id}
            order={order}
            pending={pendingOrderIds.has(order.id)}
            t={t}
            onManual={onManual}
            onResend={onResend}
            onDragState={onDragState}
          />
        ))}
        {orders.length === 0 ? <p className="text-xs text-muted">{t("distribution.ordersPanel.empty")}</p> : null}
      </div>
    </aside>
  );
}
