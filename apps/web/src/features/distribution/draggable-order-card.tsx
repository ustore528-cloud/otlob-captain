import { GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DistributionOrderOfferCountdown } from "@/features/distribution/components/distribution-order-offer-countdown";
import type { OrderListItem } from "@/types/api";
import { orderStatusBadgeVariant, orderStatusLabel } from "@/lib/order-status";

type Props = {
  order: OrderListItem;
  onDragState: (orderId: string | null) => void;
  onManual: (order: OrderListItem) => void;
  onResend: (order: OrderListItem) => void;
  busy?: boolean;
};

export function DraggableOrderCard({ order, onDragState, onManual, onResend, busy }: Props) {
  return (
    <Card
      draggable
      onDragStart={(e) => {
        onDragState(order.id);
        e.dataTransfer.setData("application/x-order-id", order.id);
        e.dataTransfer.setData("text/plain", order.id);
        e.dataTransfer.effectAllowed = "copy";
      }}
      onDragEnd={() => onDragState(null)}
      className="border-card-border bg-card p-3 shadow-sm transition hover:border-primary/30"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 gap-1.5">
          <div className="mt-0.5 shrink-0 text-muted" title="سحب للتعيين على الخريطة">
            <GripVertical className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-sm font-semibold" dir="ltr">
                {order.orderNumber}
              </span>
              <Badge variant={orderStatusBadgeVariant(order.status)}>{orderStatusLabel(order.status)}</Badge>
              {order.status === "ASSIGNED" && order.pendingOfferExpiresAt ? (
                <DistributionOrderOfferCountdown expiresAtIso={order.pendingOfferExpiresAt} />
              ) : null}
            </div>
            <p className="mt-0.5 text-sm leading-tight text-muted">{order.customerName}</p>
            <p className="text-xs leading-tight text-muted" dir="ltr">
              {order.customerPhone}
            </p>
            <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted">{order.pickupAddress}</p>
            {order.assignedCaptain ? (
              <p className="mt-0.5 text-[11px] text-muted">
                الكابتن الحالي: {order.assignedCaptain.user.fullName}
                {order.status === "ASSIGNED" ? " (بانتظار القبول/الرفض)" : ""}
              </p>
            ) : null}
            {order.distributionMode === "AUTO" && order.status === "ASSIGNED" ? (
              <p className="mt-1 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] leading-snug text-amber-900 dark:text-amber-100">
                التوزيع التلقائي: عند الرفض أو انتهاء المهلة ينتقل الطلب تلقائياً إلى كابتن آخر متاح.
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-1.5 sm:w-auto sm:items-end">
          <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => onManual(order)}>
            تعيين يدوي
          </Button>
          <Button type="button" size="sm" variant="default" disabled={busy} onClick={() => onResend(order)}>
            إعادة توزيع
          </Button>
        </div>
      </div>
    </Card>
  );
}
