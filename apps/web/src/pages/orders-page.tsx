import { useMemo, useState } from "react";
import { Radio } from "lucide-react";
import {
  useAssignOrderToCaptain,
  useCaptains,
  useOrders,
  useResendOrderToDistribution,
  useStartOrderAutoDistribution,
} from "@/hooks";
import { ManualAssignModal } from "@/components/manual-assign-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/layout/page-header";
import { orderStatusBadgeVariant, orderStatusLabel } from "@/lib/order-status";
import { ORDERS_PAGE_INITIAL_LIST_PARAMS } from "@/router/loaders";
import { useAuthStore } from "@/stores/auth-store";
import type { OrderListItem } from "@/types/api";

const STATUS_OPTS: { value: string; label: string }[] = [
  { value: "", label: "كل الحالات" },
  { value: "PENDING", label: "بانتظار التوزيع" },
  { value: "CONFIRMED", label: "تجهيز" },
  { value: "ASSIGNED", label: "مُعيَّن" },
  { value: "ACCEPTED", label: "مقبول" },
  { value: "PICKED_UP", label: "تم الاستلام" },
  { value: "IN_TRANSIT", label: "قيد التوصيل" },
  { value: "DELIVERED", label: "تم التسليم" },
  { value: "CANCELLED", label: "ملغى" },
];

export function OrdersPage() {
  const role = useAuthStore((s) => s.user?.role);
  const [status, setStatus] = useState(ORDERS_PAGE_INITIAL_LIST_PARAMS.status);
  const [q, setQ] = useState("");
  const [manualOrder, setManualOrder] = useState<OrderListItem | null>(null);

  const canDispatch = role === "ADMIN" || role === "DISPATCHER";

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
  const captains = useCaptains(
    { page: 1, pageSize: 200 },
    { enabled: Boolean(manualOrder) && canDispatch },
  );

  const auto = useStartOrderAutoDistribution();
  const resend = useResendOrderToDistribution();
  const assign = useAssignOrderToCaptain();

  const rows = orders.data?.items ?? [];

  const filterNote = useMemo(() => {
    if (!q.trim()) return null;
    return /^[\d+\s()-]{5,}$/.test(q.trim())
      ? "يبحث في هاتف العميل."
      : "يبحث في رقم الطلب (نص جزئي).";
  }, [q]);

  return (
    <div className="grid gap-8">
      <PageHeader
        title="الطلبات"
        description="بحث وتصفية، تعيين يدوي، وإعادة التوزيع للصلاحيات المخولة."
        actions={
          <Button type="button" variant="secondary" onClick={() => void orders.refetch()} disabled={orders.isFetching}>
            <Radio className="opacity-80" />
            تحديث
          </Button>
        }
      />

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
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs text-muted">الحالة</Label>
              <select
                className="h-10 rounded-lg border border-card-border bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {STATUS_OPTS.map((o) => (
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
          {orders.isLoading ? (
            <p className="text-sm text-muted">جارٍ التحميل…</p>
          ) : orders.isError ? (
            <p className="text-sm text-red-600">{(orders.error as Error).message}</p>
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
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={auto.isPending}
                            onClick={() => auto.mutate(o.id)}
                          >
                            توزيع تلقائي
                          </Button>
                        ) : null}
                        {canDispatch ? (
                          <Button size="sm" variant="secondary" onClick={() => setManualOrder(o)}>
                            تعيين يدوي
                          </Button>
                        ) : null}
                        {canDispatch && o.status !== "DELIVERED" && o.status !== "CANCELLED" ? (
                          <Button
                            size="sm"
                            variant="default"
                            disabled={resend.isPending}
                            onClick={() => resend.mutate(o.id)}
                          >
                            إعادة توزيع
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

      <ManualAssignModal
        open={Boolean(manualOrder)}
        onClose={() => setManualOrder(null)}
        orderLabel={manualOrder?.orderNumber ?? ""}
        captains={captains.data?.items ?? []}
        isPending={assign.isPending}
        onSubmit={(captainId) => {
          if (manualOrder)
            assign.mutate(
              { orderId: manualOrder.id, captainId, mode: "manual" },
              { onSuccess: () => setManualOrder(null) },
            );
        }}
      />
    </div>
  );
}
