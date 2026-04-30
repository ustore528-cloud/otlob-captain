import type { ActiveMapCaptain } from "@/types/api";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { getLocalizedText } from "@/i18n/localize-dynamic-text";
import { isCaptainLocationStale } from "@/features/distribution/captain-map-visual";

type Props = {
  captain: ActiveMapCaptain;
  pending?: boolean;
  onDropOrderOnCaptain: (orderId: string, captainId: string) => void;
  activeDragOrderId: string | null;
  onClick?: (captainId: string) => void;
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

function statusLabel(c: ActiveMapCaptain, t: (k: string) => string): string {
  if (isCaptainLocationStale(c)) return "موقع قديم";
  if (c.activeOrders > 0) return t("distribution.captainCard.busy");
  if (c.waitingOffers > 0) return t("distribution.captainCard.waiting");
  if (c.availabilityStatus === "AVAILABLE") return t("distribution.captainCard.available");
  return t("distribution.captainCard.far");
}

export function CaptainMiniCard({
  captain,
  pending,
  onDropOrderOnCaptain,
  activeDragOrderId,
  onClick,
  dropAllow,
  onDropRejectedByGuard,
}: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? i18n.language;
  const displayName = getLocalizedText(captain.user.fullName, {
    lang,
    valueTranslations: captain.user.displayI18n?.fullName,
    mode: "generic",
  });
  const areaLabel = getLocalizedText(captain.area, {
    lang,
    valueTranslations: captain.displayI18n?.area,
    mode: "place",
  });
  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-2 shadow-sm transition",
        cardTone(captain),
        pending && "opacity-60",
        onClick ? "cursor-pointer hover:bg-slate-50" : "",
      )}
      onClick={() => onClick?.(captain.id)}
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
        {initials(displayName || captain.user.fullName)}
      </div>
      <p className="truncate text-xs font-semibold">{displayName}</p>
      <p className="truncate text-[10px] text-muted">{areaLabel.trim() || "—"}</p>
      <p className="text-[10px] text-muted">
        {captain.lastLocation ? (isCaptainLocationStale(captain) ? "موقع قديم" : t("distribution.captainCard.near")) : "—"}
      </p>
      <p className="mt-1 text-[10px] font-semibold">{statusLabel(captain, t)}</p>
    </div>
  );
}
