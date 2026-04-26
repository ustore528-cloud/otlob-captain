import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { clampLatLngPair, ISRAEL_LEAFLET_MAX_BOUNDS } from "@/lib/israel-map-bounds";

function nearlySame(a: number, b: number) {
  return Math.abs(a - b) < 1e-7;
}

export type DashboardMapPickerHandle = {
  /** يقرأ مركز الخريطة والتكبير الحالي ويُرسلها للوالد (مثل التحديث التلقائي عند الحركة). */
  syncFromMap: () => void;
};

type Props = {
  latitude: number;
  longitude: number;
  zoom: number;
  onViewChange: (next: { latitude: number; longitude: number; zoom: number }) => void;
  className?: string;
};

/**
 * خريطة تفاعلية لاختيار الإحداثيات الافتراضية — الوالد يحفظ عند الضغط على حفظ في البطاقة.
 */
export const DashboardMapPicker = forwardRef<DashboardMapPickerHandle, Props>(function DashboardMapPicker(
  { latitude, longitude, zoom, onViewChange, className },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const syncingFromProps = useRef(false);
  const onViewChangeRef = useRef(onViewChange);
  onViewChangeRef.current = onViewChange;

  useImperativeHandle(ref, () => ({
    syncFromMap: () => {
      const map = mapRef.current;
      if (!map) return;
      const c = map.getCenter();
      onViewChangeRef.current({ latitude: c.lat, longitude: c.lng, zoom: map.getZoom() });
    },
  }));

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const maxBounds = L.latLngBounds(ISRAEL_LEAFLET_MAX_BOUNDS);
    const map = L.map(host, {
      zoomControl: true,
      maxBounds,
      maxBoundsViscosity: 1,
    }).setView(clampLatLngPair([latitude, longitude]), zoom);
    mapRef.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    }).addTo(map);

    const emit = () => {
      if (syncingFromProps.current) return;
      const c = map.getCenter();
      onViewChangeRef.current({ latitude: c.lat, longitude: c.lng, zoom: map.getZoom() });
    };

    map.on("moveend", emit);
    map.on("zoomend", emit);
    map.on("click", (e: L.LeafletMouseEvent) => {
      syncingFromProps.current = true;
      const p = clampLatLngPair([e.latlng.lat, e.latlng.lng]);
      map.setView(p, map.getZoom(), { animate: true });
      syncingFromProps.current = false;
      emit();
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- تهيئة مرة واحدة
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const c = map.getCenter();
    if (nearlySame(c.lat, latitude) && nearlySame(c.lng, longitude) && map.getZoom() === zoom) {
      return;
    }
    syncingFromProps.current = true;
    map.setView(clampLatLngPair([latitude, longitude]), zoom);
    syncingFromProps.current = false;
  }, [latitude, longitude, zoom]);

  useEffect(() => {
    mapRef.current?.invalidateSize();
  }, []);

  return <div ref={hostRef} className={className ?? "h-[min(280px,40vh)] w-full rounded-lg border border-card-border"} />;
});
