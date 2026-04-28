import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { useCaptainOrdersReport } from "@/hooks";
import { orderStatusBadgeVariant, orderStatusLabel } from "@/lib/order-status";
import type { ActiveMapCaptain, CaptainListItem } from "@/types/api";
import { captainUserNameDisplay } from "@/i18n/localize-entity-labels";

type Props = {
  open: boolean;
  onClose: () => void;
  captain: ActiveMapCaptain | null;
  rosterCaptain?: CaptainListItem | null;
};

const ACTIVE_ORDER_STATUSES = new Set(["ASSIGNED", "ACCEPTED", "PICKED_UP", "IN_TRANSIT", "CONFIRMED", "PENDING"]);

export function CaptainDetailsModal({ open, onClose, captain, rosterCaptain }: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? i18n.language;
  const captainId = captain?.id ?? null;
  const ordersQ = useCaptainOrdersReport(
    captainId,
    { page: 1, pageSize: 20, currentOnly: true },
    { enabled: open && Boolean(captainId) },
  );
  const activeOrders = useMemo(
    () =>
      (ordersQ.data?.items ?? []).filter(
        (o) =>
          ACTIVE_ORDER_STATUSES.has(o.status) &&
          // UI guard: never show orders assigned to another captain inside this captain modal.
          o.assignedCaptain?.id === captainId,
      ),
    [ordersQ.data?.items, captainId],
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={captain ? captainUserNameDisplay(captain, lang) : t("distribution.common.selectedCaptain")}
      description="حالة الكابتن وطلباته المسندة فقط"
      className="max-w-2xl"
    >
      {!captain ? null : (
        <div className="grid gap-4 text-sm">
          <div className="grid gap-2 rounded-lg border border-card-border bg-card/60 p-3 sm:grid-cols-2">
            <p>
              <span className="text-muted">الحالة:</span> <span className="font-semibold">{captain.availabilityStatus}</span>
            </p>
            <p>
              <span className="text-muted">العروض المنتظرة:</span> <span className="font-semibold">{captain.waitingOffers}</span>
            </p>
            <p>
              <span className="text-muted">الطلبات النشطة:</span> <span className="font-semibold">{captain.activeOrders}</span>
            </p>
            <p dir="ltr">
              <span className="text-muted">الهاتف:</span>{" "}
              <span className="font-semibold">{rosterCaptain?.user.phone ?? captain.user.phone}</span>
            </p>
          </div>

          <div className="rounded-lg border border-card-border">
            <div className="border-b border-card-border px-3 py-2 font-semibold">الطلبات النشطة</div>
            <div className="max-h-72 overflow-y-auto p-2">
              {ordersQ.isLoading ? <p className="text-muted">جاري تحميل الطلبات...</p> : null}
              {ordersQ.isError ? <p className="text-red-600">{(ordersQ.error as Error).message}</p> : null}
              {!ordersQ.isLoading && !ordersQ.isError && activeOrders.length === 0 ? (
                <p className="text-muted">لا توجد طلبات نشطة لهذا الكابتن الآن.</p>
              ) : null}
              {activeOrders.map((o) => (
                <div key={o.id} className="mb-2 rounded-md border border-card-border bg-background px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-xs" dir="ltr">
                      {o.orderNumber}
                    </p>
                    <Badge variant={orderStatusBadgeVariant(o.status)}>{orderStatusLabel(o.status)}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted">{o.customerName}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
