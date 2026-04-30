import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { clampLatLng, ISRAEL_LEAFLET_MAX_BOUNDS } from "@/lib/israel-map-bounds";

export type MapPoint = {
  lat: number;
  lng: number;
  label: string;
  color: string;
};

type Props = {
  points: MapPoint[];
  className?: string;
};

/** خريطة Leaflet + OSM — للصفحة العامة؛ يُفضّل عرض الويز كنقرة بدل تضمين Google. */
export function PublicTrackingLeaflet({ points, className }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const bounds = L.latLngBounds(ISRAEL_LEAFLET_MAX_BOUNDS);
    const m = L.map(el, { maxBounds: bounds, maxBoundsViscosity: 0.72, zoomControl: true });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(m);
    const layer = L.layerGroup().addTo(m);
    mapRef.current = m;
    layerRef.current = layer;
    try {
      m.fitBounds(bounds, { animate: false, padding: [8, 8] });
    } catch {
      m.setView(bounds.getCenter(), 11);
    }
    return () => {
      try {
        m.remove();
      } catch {
        /* noop */
      }
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const m = mapRef.current;
    const layer = layerRef.current;
    if (!m || !layer) return;

    layer.clearLayers();

    const valid = points.map((p) => {
      const q = clampLatLng(p.lat, p.lng);
      return {
        lat: q.lat,
        lng: q.lng,
        label: p.label,
        color: p.color,
      };
    });

    const ll: L.LatLng[] = [];
    for (const p of valid) {
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
      const icon = L.divIcon({
        className: "",
        html: `<span style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:9999px;background:${p.color};border:2px solid #fff;box-shadow:0 1px 6px rgba(15,23,42,0.35);"></span>`,
        iconSize: [26, 26],
      });
      ll.push(L.latLng(p.lat, p.lng));
      const mk = L.marker([p.lat, p.lng], { icon }).addTo(layer);
      mk.bindPopup(p.label);
    }

    if (ll.length === 0) return;
    try {
      m.fitBounds(L.latLngBounds(ll), { padding: [34, 34], maxZoom: 17, animate: true });
    } catch {
      const first = ll[0]!;
      m.setView(first, Math.min(Math.max(m.getZoom(), 13), 17));
    }
  }, [points]);

  return <div ref={hostRef} className={className ?? "h-[220px] w-full rounded-2xl border border-slate-200"} />;
}
