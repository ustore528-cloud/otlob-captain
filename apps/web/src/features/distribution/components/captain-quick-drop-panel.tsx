import { useEffect, useState } from "react";
import type { ActiveMapCaptain } from "@/types/api";
import {
  assignmentOfferSecondsLeft,
  captainMapVisual,
} from "@/features/distribution/captain-map-visual";

type Props = {
  captains: ActiveMapCaptain[];
  onDropOrderOnCaptain: (orderId: string, captainId: string) => void;
};

export function CaptainQuickDropPanel({ captains, onDropOrderOnCaptain }: Props) {
  const [, setCountdownTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setCountdownTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="grid gap-2 rounded-2xl border border-card-border bg-card p-4 shadow-sm">
      <h3 className="text-sm font-semibold">إفلات سريع — الكباتن</h3>
      <p className="text-xs text-muted">ألوان البطاقات مطابقة لحالة الكابتن على الخريطة.</p>
      <div className="mt-2 grid max-h-[420px] gap-2 overflow-y-auto pe-1">
        {captains.map((c) => {
          const vis = captainMapVisual(c);
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
                e.dataTransfer.dropEffect = "copy";
              }}
              onDrop={(e) => {
                e.preventDefault();
                const orderId = e.dataTransfer.getData("application/x-order-id") || e.dataTransfer.getData("text/plain");
                if (orderId) onDropOrderOnCaptain(orderId, c.id);
              }}
            >
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
              {secLeft !== null ? (
                <div dir="ltr" className="mt-1 text-[11px] font-semibold" style={{ color: "#713f12" }}>
                  ⏱ {secLeft} ث
                </div>
              ) : null}
              <div className="mt-1 text-[11px] text-foreground/70">{c.availabilityStatus}</div>
              <div className="mt-1 text-[11px] text-foreground/70">
                بانتظار رد: {c.waitingOffers} · طلبات نشطة: {c.activeOrders}
              </div>
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
