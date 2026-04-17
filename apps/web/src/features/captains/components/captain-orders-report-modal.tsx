import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useCaptainOrdersReport, useCaptainStats } from "@/hooks";
import { orderStatusBadgeVariant, orderStatusLabel } from "@/lib/order-status";
import { ORDER_STATUS_FILTER_OPTIONS } from "@/features/orders/constants";
import type { CaptainListItem } from "@/types/api";
import type { CaptainOrdersQueryParams } from "@/lib/api/query-keys";

const selectClass =
  "h-10 rounded-lg border border-card-border bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

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

export function CaptainOrdersReportModal({ captain, open, onClose }: Props) {
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

  const title = captain ? `تقرير — ${captain.user.fullName}` : "تقرير الكابتن";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description="الطلبات المرتبطة بهذا الكابتن (تعيين حالي أو سجل تعيينات). فلترة بالتاريخ والبحث والمنطقة."
      className="max-w-4xl max-h-[90vh] overflow-y-auto"
    >
      <div className="grid gap-6">
        <div className="grid gap-3 rounded-xl border border-card-border bg-background/50 p-4 text-sm">
          <p className="text-xs font-medium text-muted">ملخص سريع</p>
          {stats.isLoading ? (
            <p className="text-muted">جارٍ التحميل…</p>
          ) : stats.isError ? (
            <p className="text-red-600">{(stats.error as Error).message}</p>
          ) : stats.data ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <div className="text-xs text-muted">طلبات مسلّمة</div>
                <div className="text-lg font-semibold tabular-nums">{stats.data.ordersDelivered}</div>
              </div>
              <div>
                <div className="text-xs text-muted">طلبات نشطة مع الكابتن</div>
                <div className="text-lg font-semibold tabular-nums">{stats.data.activeOrders}</div>
              </div>
              <div className="sm:col-span-1">
                <div className="text-xs text-muted">آخر موقع</div>
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
          <p className="text-sm font-medium">تصفية الطلبات</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="grid gap-1">
              <Label className="text-xs text-muted">من تاريخ</Label>
              <Input
                type="date"
                className={selectClass}
                value={f.from}
                onChange={(e) => setF((p) => ({ ...p, page: 1, from: e.target.value }))}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs text-muted">إلى تاريخ</Label>
              <Input
                type="date"
                className={selectClass}
                value={f.to}
                onChange={(e) => setF((p) => ({ ...p, page: 1, to: e.target.value }))}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs text-muted">المنطقة (موقع الطلب)</Label>
              <Input
                placeholder="مثال: الرياض"
                value={f.area}
                onChange={(e) => setF((p) => ({ ...p, page: 1, area: e.target.value }))}
              />
            </div>
            <div className="grid gap-1 sm:col-span-2">
              <Label className="text-xs text-muted">بحث (رقم طلب، عميل، هاتف، عنوان…)</Label>
              <Input
                dir="ltr"
                className="text-left"
                placeholder="بحث"
                value={f.q}
                onChange={(e) => setF((p) => ({ ...p, page: 1, q: e.target.value }))}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs text-muted">حالة الطلب</Label>
              <select
                className={selectClass}
                value={f.status}
                onChange={(e) => setF((p) => ({ ...p, page: 1, status: e.target.value }))}
              >
                {ORDER_STATUS_FILTER_OPTIONS.map((o) => (
                  <option key={o.value || "all"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-card-border">
          {orders.isLoading ? (
            <p className="p-4 text-sm text-muted">جارٍ تحميل الطلبات…</p>
          ) : orders.isError ? (
            <p className="p-4 text-sm text-red-600">{(orders.error as Error).message}</p>
          ) : (
            <>
              <table className="w-full min-w-[760px] border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="text-muted">
                    <th className="border-b border-card-border px-3 py-2 text-right font-medium">الطلب</th>
                    <th className="border-b border-card-border px-3 py-2 text-right font-medium">الحالة</th>
                    <th className="border-b border-card-border px-3 py-2 text-right font-medium">العميل</th>
                    <th className="border-b border-card-border px-3 py-2 text-right font-medium">المنطقة</th>
                    <th className="border-b border-card-border px-3 py-2 text-right font-medium">المتجر</th>
                    <th className="border-b border-card-border px-3 py-2 text-right font-medium">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {(orders.data?.items ?? []).map((o) => (
                    <tr key={o.id} className="hover:bg-accent/40">
                      <td className="border-b border-card-border px-3 py-2 align-top font-mono text-xs" dir="ltr">
                        {o.orderNumber}
                      </td>
                      <td className="border-b border-card-border px-3 py-2 align-top">
                        <Badge variant={orderStatusBadgeVariant(o.status)}>{orderStatusLabel(o.status)}</Badge>
                      </td>
                      <td className="border-b border-card-border px-3 py-2 align-top">
                        <div className="font-medium">{o.customerName}</div>
                        <div className="text-xs text-muted" dir="ltr">
                          {o.customerPhone}
                        </div>
                      </td>
                      <td className="border-b border-card-border px-3 py-2 align-top text-xs">{o.area}</td>
                      <td className="border-b border-card-border px-3 py-2 align-top text-xs">{o.store.name}</td>
                      <td className="border-b border-card-border px-3 py-2 align-top text-xs text-muted" dir="ltr">
                        {new Date(o.createdAt).toLocaleString("ar-SA")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {orders.data && orders.data.items.length === 0 ? (
                <p className="p-4 text-sm text-muted">لا توجد طلبات مطابقة.</p>
              ) : null}
              {orders.data ? (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-card-border px-3 py-2 text-xs text-muted">
                  <span>
                    إجمالي {orders.data.total} — صفحة {f.page} من {Math.max(1, Math.ceil(orders.data.total / f.pageSize))}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={f.page <= 1}
                      onClick={() => setF((p) => ({ ...p, page: Math.max(1, p.page - 1) }))}
                    >
                      السابق
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={f.page * f.pageSize >= orders.data.total}
                      onClick={() => setF((p) => ({ ...p, page: p.page + 1 }))}
                    >
                      التالي
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="flex justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            إغلاق
          </Button>
        </div>
      </div>
    </Modal>
  );
}
