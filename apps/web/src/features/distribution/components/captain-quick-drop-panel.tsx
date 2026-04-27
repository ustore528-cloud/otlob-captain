import { useEffect, useMemo, useState } from "react";
import type { ActiveMapCaptain } from "@/types/api";
import {
  assignmentOfferSecondsLeft,
  captainMapVisual,
} from "@/features/distribution/captain-map-visual";
import { toast } from "sonner";

type Props = {
  captains: ActiveMapCaptain[];
  onDropOrderOnCaptain: (orderId: string, captainId: string) => void;
  pendingOrderIds?: string[];
  pendingCaptainIds?: string[];
  /** Same as map — used with `getData` fallback for supervisor-linked UI guard. */
  activeDragOrderId: string | null;
  /** When set, drop is blocked if this returns false (roster in-scope check). */
  dropAllow?: (orderId: string, captainId: string) => boolean;
  onDropRejectedByGuard?: () => void;
};

const defaultReassignHint = "هذا الكابتن خارج نطاق التوزيع المسموح لهذا الطلب (أو اختر من القائمة المتوافقة).";

export function CaptainQuickDropPanel({
  captains,
  onDropOrderOnCaptain,
  pendingOrderIds = [],
  pendingCaptainIds = [],
  activeDragOrderId,
  dropAllow,
  onDropRejectedByGuard = () => toast.error(defaultReassignHint),
}: Props) {
  const [, setCountdownTick] = useState(0);
  const pendingOrderSet = useMemo(() => new Set(pendingOrderIds), [pendingOrderIds]);
  const pendingCaptainSet = useMemo(() => new Set(pendingCaptainIds), [pendingCaptainIds]);

  useEffect(() => {
    const id = window.setInterval(() => setCountdownTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="grid gap-2 rounded-2xl border border-card-border bg-card p-3 shadow-sm sm:p-4">
      <p className="text-xs text-muted">
        ألوان البطاقات = حالة الكابتن على الخريطة. أسفل الاسم:{" "}
        <span className="font-semibold text-amber-900/90 dark:text-amber-200">بانتظار الرد</span> (عرض يحتاج قبولاً) و{" "}
        <span className="font-semibold text-emerald-900/90 dark:text-emerald-200">طلبات نشطة</span> (قيد التوصيل).
      </p>
      <div className="mt-1 grid max-h-[min(420px,50vh)] gap-2 overflow-y-auto pe-1">
        {captains.map((c) => {
          const vis = captainMapVisual(c);
          const isCaptainTargetPending = pendingCaptainSet.has(c.id);
          const secLeft =
            c.waitingOffers > 0 && c.assignmentOfferExpiresAt
              ? assignmentOfferSecondsLeft(c.assignmentOfferExpiresAt)
              : null;
          return (
            <div
              key={c.id}
              className={`rounded-xl border-[3px] px-3 py-2 text-sm transition hover:brightness-[0.98] dark:hover:brightness-110 ${
                vis.pulse ? "animate-pulse" : ""
              }`}
              style={{ borderColor: vis.border, backgroundColor: vis.bg }}
              onDragOver={(e) => {
                e.preventDefault();
                const fromDt =
                  e.dataTransfer.getData("application/x-order-id") || e.dataTransfer.getData("text/plain");
                const orderId = (activeDragOrderId || fromDt || "").trim() || null;
                const ok = !orderId || !dropAllow || dropAllow(orderId, c.id);
                e.dataTransfer.dropEffect = ok ? "copy" : "none";
              }}
              onDrop={(e) => {
                e.preventDefault();
                const fromDt =
                  e.dataTransfer.getData("application/x-order-id") || e.dataTransfer.getData("text/plain");
                const orderId = (fromDt || activeDragOrderId || "").trim();
                if (!orderId || pendingOrderSet.has(orderId)) return;
                if (dropAllow && !dropAllow(orderId, c.id)) {
                  onDropRejectedByGuard();
                  return;
                }
                onDropOrderOnCaptain(orderId, c.id);
              }}
            >
              {isCaptainTargetPending ? (
                <div className="mb-1 inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  استقبال تعيين...
                </div>
              ) : null}
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="font-medium text-foreground">{c.user.fullName}</div>
                <span
                  className="max-w-[58%] shrink-0 text-end text-[10px] font-medium leading-tight text-foreground/90"
                  title={vis.label}
                >
                  {vis.label}
                </span>
              </div>
              <div className="mt-0.5 text-xs text-foreground/80" dir="ltr">
                {c.user.phone}
              </div>
              <div className="mt-2 flex flex-wrap gap-2 [direction:rtl]">
                <div
                  className="flex min-w-[6.5rem] flex-1 items-center justify-between gap-2 rounded-lg border border-amber-600/35 bg-amber-500/15 px-2 py-1.5 dark:border-amber-500/40 dark:bg-amber-500/12"
                  title="طلبات بحالة ASSIGNED — بانتظار قبول أو رفض الكابتن"
                >
                  <span className="max-w-[4.5rem] text-[10px] font-bold leading-tight text-amber-950 dark:text-amber-100">
                    بانتظار الرد
                  </span>
                  <span className="min-w-[1.25rem] text-center font-mono text-base font-black tabular-nums leading-none text-amber-950 dark:text-amber-50">
                    {c.waitingOffers}
                  </span>
                </div>
                <div
                  className="flex min-w-[6.5rem] flex-1 items-center justify-between gap-2 rounded-lg border border-emerald-600/35 bg-emerald-500/12 px-2 py-1.5 dark:border-emerald-500/35 dark:bg-emerald-500/10"
                  title="طلبات مقبولة أو قيد التوصيل (نشطة)"
                >
                  <span className="max-w-[4.5rem] text-[10px] font-bold leading-tight text-emerald-950 dark:text-emerald-100">
                    طلبات نشطة
                  </span>
                  <span className="min-w-[1.25rem] text-center font-mono text-base font-black tabular-nums leading-none text-emerald-950 dark:text-emerald-50">
                    {c.activeOrders}
                  </span>
                </div>
              </div>
              {secLeft !== null ? (
                <div dir="ltr" className="mt-1.5 text-[11px] font-semibold" style={{ color: "#713f12" }}>
                  ⏱ {secLeft} ث
                </div>
              ) : null}
              <div className="mt-1 text-[11px] text-foreground/70">{c.availabilityStatus}</div>
              {c.latestOrderNumber ? (
                <div className="mt-1 text-[11px] font-mono text-foreground/70" dir="ltr">
                  {c.latestOrderNumber} ({c.latestOrderStatus})
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
