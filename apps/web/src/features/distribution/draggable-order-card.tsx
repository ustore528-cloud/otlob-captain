import { GripVertical, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DistributionOrderOfferCountdown } from "@/features/distribution/components/distribution-order-offer-countdown";
import { formatOrderDisplayLabel } from "@captain/shared";
import type { OrderListItem } from "@/types/api";
import { orderStatusBadgeVariant, orderStatusLabel } from "@/lib/order-status";
import { cn } from "@/lib/utils";
import { useLocalizedOrderListItem } from "@/i18n/use-localized-order-display";

type Props = {
  order: OrderListItem;
  /** Queue position in the current distribution list (UI only) — see `formatDistributionQueueSerial` */
  queueSerial: string;
  onDragState: (orderId: string | null) => void;
  onManual: (order: OrderListItem) => void;
  onResend: (order: OrderListItem) => void;
  busy?: boolean;
  pendingAssignment?: {
    captainName: string;
    mode: "manual" | "drag-drop";
  };
};

function distributionCardTone(status: OrderListItem["status"]): string {
  switch (status) {
    case "PENDING":
      return "border-sky-400/70 bg-sky-50/95 shadow-sm hover:border-sky-500/80 dark:border-sky-600/55 dark:bg-sky-950/45";
    case "CONFIRMED":
      return "border-amber-400/75 bg-amber-50/95 shadow-sm hover:border-amber-500/85 dark:border-amber-600/50 dark:bg-amber-950/40";
    case "ASSIGNED":
      return "border-violet-500/80 bg-violet-50/95 shadow-md ring-1 ring-violet-500/15 hover:border-violet-600 dark:border-violet-500/55 dark:bg-violet-950/45 dark:ring-violet-400/10";
    default:
      return "border-card-border bg-card shadow-sm hover:border-primary/30";
  }
}

export function DraggableOrderCard({ order, queueSerial, onDragState, onManual, onResend, busy, pendingAssignment }: Props) {
  const { t } = useTranslation();
  const loc = useLocalizedOrderListItem(order);
  const isPendingAssign = Boolean(pendingAssignment);
  return (
    <Card
      draggable={!isPendingAssign}
      onDragStart={(e) => {
        if (isPendingAssign) return;
        onDragState(order.id);
        e.dataTransfer.setData("application/x-order-id", order.id);
        e.dataTransfer.setData("text/plain", order.id);
        e.dataTransfer.effectAllowed = "copy";
      }}
      onDragEnd={() => onDragState(null)}
      className={cn("p-3 transition", distributionCardTone(order.status), isPendingAssign && "opacity-75 saturate-50")}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 gap-1.5">
          <div
            className="mt-0.5 shrink-0 text-muted"
            title={isPendingAssign ? t("distribution.draggable.titleAssigning") : t("distribution.draggable.titleDragToMap")}
          >
            <GripVertical className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-start gap-2">
              <div
                className="flex shrink-0 flex-col items-center justify-center rounded-lg border border-border/80 bg-background/95 px-2.5 py-1.5 shadow-sm dark:bg-background/90"
                title={t("distribution.draggable.queueTitle", { number: order.orderNumber })}
                dir="ltr"
              >
                <span className="font-mono text-[1.35rem] font-bold leading-none tabular-nums tracking-tight text-foreground">
                  {queueSerial}
                </span>
                <span className="mt-0.5 text-[9px] font-semibold text-muted">{t("distribution.draggable.queueLabel")}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge className="text-xs font-semibold" variant={orderStatusBadgeVariant(order.status)}>
                    {orderStatusLabel(order.status)}
                  </Badge>
                  {isPendingAssign ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      <Loader2 className="size-3 animate-spin" />
                      {t("distribution.draggable.assigning")}
                    </span>
                  ) : null}
                  {order.status === "ASSIGNED" && order.pendingOfferExpiresAt ? (
                    <DistributionOrderOfferCountdown expiresAtIso={order.pendingOfferExpiresAt} />
                  ) : null}
                </div>
                <p
                  className="mt-1 text-[11px] font-medium leading-tight text-foreground/85 tabular-nums"
                  dir="ltr"
                  title={order.orderNumber}
                >
                  {t("distribution.draggable.refPrefix")}{" "}
                  {formatOrderDisplayLabel(order.displayOrderNo ?? null, order.orderNumber)}
                </p>
                <p className="font-mono text-[9px] leading-tight text-muted-foreground/90" dir="ltr" title={order.orderNumber}>
                  {order.orderNumber}
                </p>
                <p className="mt-0.5 text-sm font-medium leading-tight text-foreground">{loc.customerName}</p>
                <p className="text-xs leading-tight text-muted-foreground" dir="ltr">
                  {order.customerPhone}
                </p>
                <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{loc.pickupAddress}</p>
                {order.assignedCaptain ? (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {t("distribution.draggable.currentCaptain")}: {loc.assignedCaptainName}
                    {order.status === "ASSIGNED" ? t("distribution.draggable.awaitingCaptainResponseSuffix") : ""}
                  </p>
                ) : null}
                {order.distributionMode === "AUTO" && order.status === "ASSIGNED" ? (
                  <p className="mt-1 rounded-md border border-amber-500/25 bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium leading-snug text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-50">
                    {t("distribution.draggable.autoReassignNote")}
                  </p>
                ) : null}
                {isPendingAssign && pendingAssignment ? (
                  <p className="mt-1 rounded-md border border-primary/25 bg-primary/5 px-1.5 py-0.5 text-[10px] font-medium leading-snug text-primary">
                    {pendingAssignment.mode === "drag-drop"
                      ? t("distribution.draggable.pendingToDragDrop", { name: pendingAssignment.captainName })
                      : t("distribution.draggable.pendingToManual", { name: pendingAssignment.captainName })}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-1.5 sm:w-auto sm:items-end">
          <Button type="button" size="sm" variant="secondary" disabled={busy || isPendingAssign} onClick={() => onManual(order)}>
            {t("distribution.ordersPanel.manualAssign")}
          </Button>
          <Button type="button" size="sm" variant="default" disabled={busy || isPendingAssign} onClick={() => onResend(order)}>
            {t("distribution.ordersPanel.redistribute")}
          </Button>
        </div>
      </div>
    </Card>
  );
}
