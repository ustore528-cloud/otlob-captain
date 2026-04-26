import type { ActiveMapCaptain } from "@/types/api";
import { cn } from "@/lib/utils";

type Props = {
  captain: ActiveMapCaptain;
  pending?: boolean;
  onDropOrderOnCaptain: (orderId: string, captainId: string) => void;
  activeDragOrderId: string | null;
  dropAllow?: (orderId: string, captainId: string) => boolean;
  onDropRejectedByGuard?: () => void;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0] ?? "").join("").toUpperCase();
}

function cardTone(c: ActiveMapCaptain): string {
  if (!c.lastLocation || !c.user?.fullName) return "border-slate-300";
  if (c.activeOrders > 0) return "border-red-400";
  if (c.waitingOffers > 0) return "border-amber-400";
  if (c.availabilityStatus === "AVAILABLE") return "border-emerald-400";
  return "border-slate-300";
}

function statusLabel(c: ActiveMapCaptain): string {
  if (c.activeOrders > 0) return "مشغول";
  if (c.waitingOffers > 0) return "بانتظار الرد";
  if (c.availabilityStatus === "AVAILABLE") return "متاح";
  return "بعيد";
}

export function CaptainMiniCard({ captain, pending, onDropOrderOnCaptain, activeDragOrderId, dropAllow, onDropRejectedByGuard }: Props) {
  return (
    <div
      className={cn("rounded-xl border bg-white p-2 shadow-sm transition", cardTone(captain), pending && "opacity-60")}
      onDragOver={(e) => {
        e.preventDefault();
        const orderId = (e.dataTransfer.getData("application/x-order-id") || e.dataTransfer.getData("text/plain") || activeDragOrderId || "").trim();
        const ok = !orderId || !dropAllow || dropAllow(orderId, captain.id);
        e.dataTransfer.dropEffect = ok ? "copy" : "none";
      }}
      onDrop={(e) => {
        e.preventDefault();
        const orderId = (e.dataTransfer.getData("application/x-order-id") || e.dataTransfer.getData("text/plain") || activeDragOrderId || "").trim();
        if (!orderId) return;
        if (dropAllow && !dropAllow(orderId, captain.id)) {
          onDropRejectedByGuard?.();
          return;
        }
        onDropOrderOnCaptain(orderId, captain.id);
      }}
    >
      <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-bold">
        {initials(captain.user.fullName)}
      </div>
      <p className="truncate text-xs font-semibold">{captain.user.fullName}</p>
      <p className="truncate text-[10px] text-muted">{captain.area || "—"}</p>
      <p className="text-[10px] text-muted">{captain.lastLocation ? "قريب" : "—"}</p>
      <p className="mt-1 text-[10px] font-semibold">{statusLabel(captain)}</p>
    </div>
  );
}
