import { useEffect, useRef, useState } from "react";
import type { ActiveMapCaptain } from "@/types/api";
import { assignmentOfferSecondsLeft, captainMapVisual } from "@/features/distribution/captain-map-visual";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

type DistributionMapProps = {
  captains: ActiveMapCaptain[];
  /** عند الإفلات على كابتن */
  onAssignDrop: (orderId: string, captainId: string) => void;
  /** تسليط الضوء على كابتن أثناء السحب */
  draggingOrderId: string | null;
  /** مركز الخريطة عند عدم وجود كباتن أو بعد التحميل — من إعدادات اللوحة أو الافتراضي. */
  defaultCenter: [number, number];
  defaultZoom: number;
};

function vehicleGlyph(vehicleType: string): string {
  switch (vehicleType) {
    case "بسكليت":
      return "🚴";
    case "دراجه ناريه":
      return "🏍️";
    case "سيارة":
      return "🚗";
    case "شحن نقل":
      return "🚐";
    default:
      return "📦";
  }
}

function bindDropTarget(
  el: Element | null,
  captainId: string,
  onDrop: (orderId: string, captainId: string) => void,
) {
  if (!el || !(el instanceof HTMLElement)) return;
  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    el.classList.add("ring-2", "ring-primary", "ring-offset-2");
  };
  const onDragLeave = () => {
    el.classList.remove("ring-2", "ring-primary", "ring-offset-2");
  };
  const onDropEv = (e: DragEvent) => {
    e.preventDefault();
    el.classList.remove("ring-2", "ring-primary", "ring-offset-2");
    const orderId = e.dataTransfer?.getData("application/x-order-id") || e.dataTransfer?.getData("text/plain");
    if (orderId) onDrop(orderId, captainId);
  };
  el.addEventListener("dragover", onDragOver);
  el.addEventListener("dragleave", onDragLeave);
  el.addEventListener("drop", onDropEv);
  return () => {
    el.removeEventListener("dragover", onDragOver);
    el.removeEventListener("dragleave", onDragLeave);
    el.removeEventListener("drop", onDropEv);
  };
}

export function DistributionMap({
  captains,
  onAssignDrop,
  draggingOrderId,
  defaultCenter,
  defaultZoom,
}: DistributionMapProps) {
  const [countdownTick, setCountdownTick] = useState(0);
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const cleanupsRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    const id = window.setInterval(() => setCountdownTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const map = L.map(host, { zoomControl: true }).setView(defaultCenter, defaultZoom);
    mapRef.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    }).addTo(map);

    const group = L.layerGroup().addTo(map);
    layerRef.current = group;

    return () => {
      cleanupsRef.current.forEach((fn) => fn());
      cleanupsRef.current = [];
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // الإحداثيات الابتدائية من أول رسم فقط؛ التحديث اللاحق لإعدادات الخادم عبر التأثير التالي.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setView(defaultCenter, defaultZoom);
  }, [defaultCenter[0], defaultCenter[1], defaultZoom]);

  useEffect(() => {
    const map = mapRef.current;
    const group = layerRef.current;
    if (!map || !group) return;

    cleanupsRef.current.forEach((fn) => fn());
    cleanupsRef.current = [];
    group.clearLayers();

    const withLoc = captains.filter((c) => c.lastLocation);
    if (withLoc.length > 0) {
      const bounds = L.latLngBounds(withLoc.map((c) => [c.lastLocation!.latitude, c.lastLocation!.longitude]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    } else {
      map.setView(defaultCenter, defaultZoom);
    }

    for (const c of captains) {
      const loc = c.lastLocation;
      if (!loc) continue;
      const vis = captainMapVisual(c);
      const glyph = vehicleGlyph(c.vehicleType);
      const pulseClass = vis.pulse ? "distribution-map-marker--pulse" : "";
      const secLeft =
        c.waitingOffers > 0 && c.assignmentOfferExpiresAt
          ? assignmentOfferSecondsLeft(c.assignmentOfferExpiresAt)
          : null;
      const countdownLine =
        secLeft !== null
          ? `<div dir="ltr" style="margin-top:3px;font-size:11px;font-weight:700;color:#713f12;letter-spacing:0.02em;white-space:nowrap;text-align:center">⏱ ${secLeft} ث</div>`
          : "";

      const html = `
        <div style="display:flex;flex-direction:column;align-items:center;min-width:52px" title="${vis.label.replace(/"/g, "&quot;")}">
        <div class="distribution-map-marker ${pulseClass}" style="
          width:40px;height:40px;border-radius:9999px;
          border:3px solid ${vis.border};background:${vis.bg};
          display:flex;align-items:center;justify-content:center;
          font-size:20px;line-height:1;box-shadow:0 2px 8px rgba(0,0,0,.2);
        ">${glyph}</div>${countdownLine}</div>`;

      const icon = L.divIcon({
        className: "distribution-map-marker-wrap",
        html,
        iconSize: [56, 58],
        iconAnchor: [28, 52],
        popupAnchor: [0, -48],
      });

      const popupCountdown =
        secLeft !== null
          ? `<br/><span dir="ltr" style="font-weight:600;color:#92400e">المهلة: ${secLeft} ث متبقية</span>`
          : "";

      const marker = L.marker([loc.latitude, loc.longitude], { icon });
      marker.bindPopup(
        `<div dir="rtl"><strong>${c.user.fullName}</strong><br/>${c.vehicleType}<br/>${c.user.phone}<br/><span style="opacity:.85">${vis.label}</span>${popupCountdown}<br/><span style="display:inline-block;margin-top:4px;padding:2px 8px;border-radius:6px;border:1px solid rgba(180,83,9,.35);background:rgba(245,158,11,.15);font-weight:700;color:#78350f">بانتظار الرد: ${c.waitingOffers}</span> <span style="display:inline-block;margin-top:4px;padding:2px 8px;border-radius:6px;border:1px solid rgba(5,150,105,.35);background:rgba(16,185,129,.12);font-weight:700;color:#065f46">نشطة: ${c.activeOrders}</span>${c.recentRejects ? `<br/>رفض حديث: ${c.recentRejects}` : ""}${c.latestOrderNumber ? `<br/><span dir="ltr">${c.latestOrderNumber} (${c.latestOrderStatus})</span>` : ""}</div>`,
      );
      marker.addTo(group);

      const el = marker.getElement() ?? null;
      const cleanup = bindDropTarget(el, c.id, onAssignDrop);
      if (cleanup) cleanupsRef.current.push(cleanup);
    }
  }, [captains, onAssignDrop, countdownTick, defaultCenter, defaultZoom]);

  useEffect(() => {
    mapRef.current?.invalidateSize();
  }, [draggingOrderId]);

  return (
    <div className="overflow-hidden rounded-2xl border border-card-border shadow-sm">
      <style>{`
        @keyframes distribution-map-marker-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.12); }
        }
        .distribution-map-marker--pulse {
          animation: distribution-map-marker-pulse 1.4s ease-in-out infinite;
        }
        .distribution-map-marker-wrap {
          background: transparent !important;
          border: none !important;
        }
      `}</style>
      <div className="flex flex-col gap-2 border-b border-card-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">خريطة الكباتن</p>
          <p className="text-xs text-muted">
            {draggingOrderId
              ? "أفلت الطلب على أيقونة الكابتن للتعيين (سحب وإفلات)"
              : "الإطار الأصفر النابض = الكابتن الذي يعرض عليه الطلب الآن؛ ينتقل تلقائياً بعد الرفض أو انتهاء المهلة. اسحب بطاقة الطلب للتعيين اليدوي."}
          </p>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted" dir="rtl">
          <span>
            <span className="inline-block h-2 w-2 rounded-full bg-[#ca8a04] align-middle ltr:mr-1 rtl:ml-1" /> بانتظار قبول
          </span>
          <span>
            <span className="inline-block h-2 w-2 rounded-full bg-[#15803d] align-middle ltr:mr-1 rtl:ml-1" /> مقبول / توصيل
          </span>
          <span>
            <span className="inline-block h-2 w-2 rounded-full bg-[#b91c1c] align-middle ltr:mr-1 rtl:ml-1" /> رفض حديث
          </span>
          <span>
            <span className="inline-block h-2 w-2 rounded-full bg-[#2563eb] align-middle ltr:mr-1 rtl:ml-1" /> متاح
          </span>
        </div>
      </div>
      <div ref={hostRef} className="h-[min(420px,55vh)] w-full" />
    </div>
  );
}
