import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { orderStatusBadgeVariant, orderStatusLabel } from "@/lib/order-status";
import { ORDER_STATUS_FILTER_OPTIONS } from "@/features/orders/constants";
import type { OrderListItem } from "@/types/api";

const selectClass =
  "h-10 rounded-lg border border-card-border bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

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
  onCancelCaptain: (orderId: string) => void;
  autoPending: boolean;
  resendPending: boolean;
  cancelPending: boolean;
};

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
  onCancelCaptain,
  autoPending,
  resendPending,
  cancelPending,
}: Props) {
  return (
    <Card className="border-card-border shadow-sm">
      <CardHeader className="grid gap-4 sm:flex sm:flex-row sm:items-end sm:justify-between">
        <div>
          <CardTitle className="text-base">تصفية</CardTitle>
          <CardDescription>رقم الطلب أو هاتف العميل، وحسب الحالة</CardDescription>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="grid gap-1">
            <Label className="text-xs text-muted">بحث</Label>
            <Input
              dir="ltr"
              className="w-56 text-left"
              placeholder="Order # أو phone"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs text-muted">الحالة</Label>
            <select className={selectClass} value={status} onChange={(e) => onStatusChange(e.target.value)}>
              {ORDER_STATUS_FILTER_OPTIONS.map((o) => (
                <option key={o.value || "all"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {filterNote ? <p className="mb-3 text-xs text-muted">{filterNote}</p> : null}
        {loading ? (
          <p className="text-sm text-muted">جارٍ التحميل…</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error.message}</p>
        ) : (
          <table className="w-full min-w-[920px] border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-muted">
                <th className="border-b border-card-border px-3 py-2 text-right font-medium">الطلب</th>
                <th className="border-b border-card-border px-3 py-2 text-right font-medium">الحالة</th>
                <th className="border-b border-card-border px-3 py-2 text-right font-medium">العميل</th>
                <th className="border-b border-card-border px-3 py-2 text-right font-medium">المتجر</th>
                <th className="border-b border-card-border px-3 py-2 text-right font-medium">المنطقة</th>
                <th className="border-b border-card-border px-3 py-2 text-right font-medium">تاريخ</th>
                <th className="border-b border-card-border px-3 py-2 text-right font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} className="hover:bg-accent/40">
                  <td className="border-b border-card-border px-3 py-3 align-top font-mono text-xs" dir="ltr">
                    {o.orderNumber}
                  </td>
                  <td className="border-b border-card-border px-3 py-3 align-top">
                    <Badge variant={orderStatusBadgeVariant(o.status)}>{orderStatusLabel(o.status)}</Badge>
                  </td>
                  <td className="border-b border-card-border px-3 py-3 align-top">
                    <div className="font-medium">{o.customerName}</div>
                    <div className="text-xs text-muted" dir="ltr">
                      {o.customerPhone}
                    </div>
                  </td>
                  <td className="border-b border-card-border px-3 py-3 align-top text-xs">{o.store.name}</td>
                  <td className="border-b border-card-border px-3 py-3 align-top text-xs">{o.area}</td>
                  <td className="border-b border-card-border px-3 py-3 align-top text-xs text-muted" dir="ltr">
                    {new Date(o.createdAt).toLocaleString("ar-SA")}
                  </td>
                  <td className="border-b border-card-border px-3 py-3 align-top">
                    <div className="flex flex-wrap gap-2">
                      {canDispatch && (o.status === "PENDING" || o.status === "CONFIRMED") ? (
                        <Button size="sm" variant="secondary" disabled={autoPending} onClick={() => onAuto(o.id)}>
                          توزيع تلقائي
                        </Button>
                      ) : null}
                      {canDispatch ? (
                        <Button size="sm" variant="secondary" onClick={() => onManual(o)}>
                          تعيين يدوي
                        </Button>
                      ) : null}
                      {canDispatch && o.status !== "DELIVERED" && o.status !== "CANCELLED" ? (
                        <Button size="sm" variant="default" disabled={resendPending} onClick={() => onResend(o.id)}>
                          إعادة توزيع
                        </Button>
                      ) : null}
                      {canDispatch &&
                      o.assignedCaptain &&
                      (o.status === "ASSIGNED" || o.status === "ACCEPTED" || o.status === "PICKED_UP") ? (
                        <Button size="sm" variant="secondary" disabled={cancelPending} onClick={() => onCancelCaptain(o.id)}>
                          إلغاء الطلب للكابتن
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
