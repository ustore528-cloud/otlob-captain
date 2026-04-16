import { GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
      className="border-card-border bg-card p-4 shadow-sm transition hover:border-primary/30"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 gap-2">
          <div className="mt-0.5 text-muted" title="سحب للتعيين على الخريطة">
            <GripVertical className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold" dir="ltr">
                {order.orderNumber}
              </span>
              <Badge variant={orderStatusBadgeVariant(order.status)}>{orderStatusLabel(order.status)}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted">{order.customerName}</p>
            <p className="text-xs text-muted" dir="ltr">
              {order.customerPhone}
            </p>
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted">{order.pickupAddress}</p>
          </div>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:items-end">
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
