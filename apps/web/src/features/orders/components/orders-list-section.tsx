import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { orderStatusBadgeVariant, orderStatusLabel } from "@/lib/order-status";
import { ORDER_STATUS_FILTER_OPTIONS } from "@/features/orders/constants";
import { ADMIN_OVERRIDE_TARGET_STATUSES, type AdminOverrideTargetStatus } from "@/hooks";
import type { OrderListItem, OrderStatus } from "@/types/api";

function canArchiveOrderStatus(status: OrderStatus): boolean {
  return !["ACCEPTED", "PICKED_UP", "IN_TRANSIT"].includes(status);
}

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
  autoPendingOrderId: string | null;
  resendPendingOrderId: string | null;
  cancelPendingOrderId: string | null;
  archivePending?: boolean;
  onArchive?: (order: OrderListItem) => void;
  archiveConfirmOrder: OrderListItem | null;
  onArchiveConfirmClose: () => void;
  onArchiveConfirm: () => void;
  adminOverrideOrder: OrderListItem | null;
  adminOverrideTarget: AdminOverrideTargetStatus;
  onAdminOverrideTargetChange: (v: AdminOverrideTargetStatus) => void;
  onAdminOverrideOpen: (order: OrderListItem) => void;
  onAdminOverrideClose: () => void;
  onAdminOverrideConfirm: () => void;
  adminOverridePending: boolean;
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
  autoPendingOrderId,
  resendPendingOrderId,
  cancelPendingOrderId,
  archivePending = false,
  onArchive,
  archiveConfirmOrder,
  onArchiveConfirmClose,
  onArchiveConfirm,
  adminOverrideOrder,
  adminOverrideTarget,
  onAdminOverrideTargetChange,
  onAdminOverrideOpen,
  onAdminOverrideClose,
  onAdminOverrideConfirm,
  adminOverridePending,
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
          <>
          <Modal
            open={Boolean(adminOverrideOrder)}
            onClose={onAdminOverrideClose}
            title="تعديل الحالة — إجراء إشرافي"
            description="يغيّر حالة الطلب مباشرة (للمشرفين فقط). عند اختيار «بانتظار التوزيع» أو «تجهيز» أو «ملغى» يُلغى تعيين الكابتن الحالي وتُلغى عروض التوزيع المعلّقة. لا يُستخدم بديلاً عن مسارات التوزيع العادية."
          >
            <div className="grid gap-3">
              {adminOverrideOrder ? (
                <p className="text-sm text-muted">
                  الطلب{" "}
                  <span className="font-mono" dir="ltr">
                    {adminOverrideOrder.orderNumber}
                  </span>{" "}
                  — الحالة الحالية:{" "}
                  <span className="font-medium">{orderStatusLabel(adminOverrideOrder.status)}</span>
                </p>
              ) : null}
              <div className="grid gap-1">
                <Label className="text-xs text-muted">الحالة المستهدفة</Label>
                <select
                  className={selectClass}
                  value={adminOverrideTarget}
                  onChange={(e) => onAdminOverrideTargetChange(e.target.value as AdminOverrideTargetStatus)}
                >
                  {ADMIN_OVERRIDE_TARGET_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {orderStatusLabel(s)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <Button type="button" variant="secondary" onClick={onAdminOverrideClose}>
                  إلغاء
                </Button>
                <Button type="button" variant="default" disabled={adminOverridePending} onClick={onAdminOverrideConfirm}>
                  تأكيد التعديل الإشرافي
                </Button>
              </div>
            </div>
          </Modal>
          <Modal
            open={Boolean(archiveConfirmOrder)}
            onClose={onArchiveConfirmClose}
            title="إزالة الطلب من القائمة التشغيلية؟"
            description="لن يُحذف الصف من قاعدة البيانات — يُخفى من قوائم التشغيل والإحصاءات الافتراضية (بما فيها بعد التسليم). الطلبات المرتبطة بحساب عميل تبقى في سجل العميل. يمكن استرجاع العرض لاحقاً عبر واجهة الإدارة (إلغاء الأرشفة)."
          >
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" onClick={onArchiveConfirmClose}>
                إلغاء
              </Button>
              <Button type="button" variant="default" disabled={archivePending} onClick={onArchiveConfirm}>
                تأكيد الإزالة
              </Button>
            </div>
          </Modal>
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
                          disabled={autoPendingOrderId === o.id}
                          onClick={() => onAuto(o.id)}
                        >
                          توزيع تلقائي
                        </Button>
                      ) : null}
                      {canDispatch ? (
                        <Button size="sm" variant="secondary" onClick={() => onManual(o)}>
                          تعيين يدوي
                        </Button>
                      ) : null}
                      {canDispatch && o.status !== "DELIVERED" && o.status !== "CANCELLED" ? (
                        <Button
                          size="sm"
                          variant="default"
                          disabled={resendPendingOrderId === o.id}
                          onClick={() => onResend(o.id)}
                        >
                          إعادة توزيع
                        </Button>
                      ) : null}
                      {canDispatch &&
                      o.assignedCaptain &&
                      (o.status === "ASSIGNED" || o.status === "ACCEPTED" || o.status === "PICKED_UP") ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={cancelPendingOrderId === o.id}
                          onClick={() => onCancelCaptain(o.id)}
                        >
                          إلغاء الطلب للكابتن
                        </Button>
                      ) : null}
                      {canDispatch ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="border-amber-200/80 text-amber-950 hover:bg-amber-50 dark:border-amber-900/50 dark:text-amber-100 dark:hover:bg-amber-950/40"
                          disabled={adminOverridePending}
                          onClick={() => onAdminOverrideOpen(o)}
                        >
                          تعديل الحالة (إشراف)
                        </Button>
                      ) : null}
                      {canDispatch && onArchive && canArchiveOrderStatus(o.status) ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="border-red-200 text-red-800 hover:bg-red-50 dark:border-red-900/50 dark:text-red-200 dark:hover:bg-red-950/40"
                          disabled={archivePending}
                          onClick={() => onArchive(o)}
                        >
                          إزالة من القائمة
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
