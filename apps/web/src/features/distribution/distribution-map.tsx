import { useEffect, useRef } from "react";
import type { ActiveMapCaptain } from "@/types/api";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

const DEFAULT_CENTER: [number, number] = [24.7136, 46.6753];

type DistributionMapProps = {
  captains: ActiveMapCaptain[];
  /** عند الإفلات على كابتن */
  onAssignDrop: (orderId: string, captainId: string) => void;
  /** تسليط الضوء على كابتن أثناء السحب */
  draggingOrderId: string | null;
};

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

export function DistributionMap({ captains, onAssignDrop, draggingOrderId }: DistributionMapProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const cleanupsRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const map = L.map(host, { zoomControl: true }).setView(DEFAULT_CENTER, 11);
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
  }, []);

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
      map.setView(DEFAULT_CENTER, 11);
    }

    for (const c of captains) {
      const loc = c.lastLocation;
      if (!loc) continue;
      const marker = L.circleMarker([loc.latitude, loc.longitude], {
        radius: 10,
        color: "#2563eb",
        weight: 2,
        fillColor: "#3b82f6",
        fillOpacity: 0.85,
      });
      marker.bindPopup(`<div dir="rtl"><strong>${c.user.fullName}</strong><br/>${c.user.phone}</div>`);
      marker.addTo(group);

    const el = marker.getElement() ?? null;
    const cleanup = bindDropTarget(el, c.id, onAssignDrop);
      if (cleanup) cleanupsRef.current.push(cleanup);
    }
  }, [captains, onAssignDrop]);

  useEffect(() => {
    mapRef.current?.invalidateSize();
  }, [draggingOrderId]);

  return (
    <div className="overflow-hidden rounded-2xl border border-card-border shadow-sm">
      <div className="flex items-center justify-between border-b border-card-border bg-card px-4 py-3">
        <div>
          <p className="text-sm font-semibold">خريطة الكباتن</p>
          <p className="text-xs text-muted">
            {draggingOrderId ? "أفلت الطلب على دائرة الكابتن للتعيين (سحب وإفلات)" : "اسحب بطاقة الطلب ثم أفلتها على الكابتن"}
          </p>
        </div>
      </div>
      <div ref={hostRef} className="h-[min(420px,55vh)] w-full" />
    </div>
  );
}
