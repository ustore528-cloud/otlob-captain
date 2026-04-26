import { useEffect, useMemo, useRef, useState } from "react";
import type { ActiveMapCaptain, OrderListItem } from "@/types/api";
import { clampLatLng, clampLatLngPair, googleMapsRestrictionOption } from "@/lib/israel-map-bounds";

declare global {
  interface Window {
    google?: any;
  }
}

type Props = {
  captains: ActiveMapCaptain[];
  orders: OrderListItem[];
  defaultCenter: [number, number];
  defaultZoom: number;
};

const GOOGLE_MAPS_SCRIPT_ID = "otlob-google-maps-script";
const GOOGLE_KEY_PLACEHOLDER = "PASTE_MY_REAL_GOOGLE_MAPS_KEY_HERE";

function getApiKey(): string {
  return (import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "").trim();
}

/** مفتاح حقيقي مفعّل — وإلا نستخدم خريطة OSM (Leaflet) في التوزيع */
export function hasGoogleMapsApiKey(): boolean {
  const k = getApiKey();
  return k.length > 0 && k !== GOOGLE_KEY_PLACEHOLDER;
}

function createCaptainIcon(status: "available" | "waiting" | "busy" | "far") {
  const color = status === "busy" ? "#dc2626" : status === "waiting" ? "#f59e0b" : status === "available" ? "#16a34a" : "#94a3b8";
  return {
    path: window.google.maps.SymbolPath.CIRCLE,
    fillColor: "#ffffff",
    fillOpacity: 1,
    strokeColor: color,
    strokeWeight: 4,
    scale: 10,
  };
}

function captainStatus(c: ActiveMapCaptain): "available" | "waiting" | "busy" | "far" {
  if (!c.lastLocation || c.availabilityStatus !== "AVAILABLE") return "far";
  if (c.activeOrders > 0) return "busy";
  if (c.waitingOffers > 0) return "waiting";
  return "available";
}

export function GoogleTrackingMap({ captains, orders, defaultCenter, defaultZoom }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any | null>(null);
  const captainMarkersRef = useRef<Map<string, any>>(new Map());
  const orderMarkersRef = useRef<Map<string, any>>(new Map());
  const directionsRendererRef = useRef<any | null>(null);
  const geocoderRef = useRef<any | null>(null);
  const geocodeCache = useRef<Map<string, { lat: number; lng: number }>>(new Map());

  const [loadError, setLoadError] = useState<string | null>(null);

  const apiKey = useMemo(() => getApiKey(), []);
  const hasUsableApiKey = hasGoogleMapsApiKey();

  useEffect(() => {
    if (!hostRef.current || !hasUsableApiKey) return;

    const startMap = () => {
      if (!hostRef.current || !window.google) return;
      if (!mapRef.current) {
        const c0 = clampLatLngPair(defaultCenter);
        mapRef.current = new window.google.maps.Map(hostRef.current, {
          center: { lat: c0[0], lng: c0[1] },
          zoom: defaultZoom,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          restriction: googleMapsRestrictionOption(),
        });
        geocoderRef.current = new window.google.maps.Geocoder();
        directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
          suppressMarkers: true,
          preserveViewport: true,
          polylineOptions: { strokeColor: "#2563eb", strokeOpacity: 0.9, strokeWeight: 4 },
        });
        directionsRendererRef.current.setMap(mapRef.current);
      }
    };
    const onScriptError = () => {
      setLoadError("Google Maps script failed to load.");
      // eslint-disable-next-line no-console
      console.error("[distribution:google-maps] script load failed");
    };
    const prevAuthFailure = (window as any).gm_authFailure;
    (window as any).gm_authFailure = () => {
      setLoadError("Google Maps JavaScript API auth failure.");
      // eslint-disable-next-line no-console
      console.error("[distribution:google-maps] gm_authFailure");
      if (typeof prevAuthFailure === "function") prevAuthFailure();
    };

    if (window.google?.maps) {
      startMap();
      return;
    }

    const existing = document.getElementById(GOOGLE_MAPS_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", startMap);
      existing.addEventListener("error", onScriptError);
      return () => {
        existing.removeEventListener("load", startMap);
        existing.removeEventListener("error", onScriptError);
      };
    }

    const script = document.createElement("script");
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=geometry`;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", startMap);
    script.addEventListener("error", onScriptError);
    document.head.appendChild(script);
    return () => {
      script.removeEventListener("load", startMap);
      script.removeEventListener("error", onScriptError);
    };
  }, [hasUsableApiKey, defaultCenter, defaultZoom]);

  useEffect(() => {
    if (!hasUsableApiKey || !mapRef.current || !window.google) return;
    const map = mapRef.current;
    const nextIds = new Set<string>();
    for (const captain of captains) {
      if (!captain.lastLocation) continue;
      nextIds.add(captain.id);
      const posCl = clampLatLng(captain.lastLocation.latitude, captain.lastLocation.longitude);
      const pos = { lat: posCl.lat, lng: posCl.lng };
      const status = captainStatus(captain);
      let marker = captainMarkersRef.current.get(captain.id);
      if (!marker) {
        marker = new window.google.maps.Marker({
          map,
          position: pos,
          icon: createCaptainIcon(status),
          title: captain.user.fullName,
          optimized: true,
        });
        captainMarkersRef.current.set(captain.id, marker);
      } else {
        marker.setPosition(pos);
        marker.setIcon(createCaptainIcon(status));
      }
    }
    for (const [id, marker] of captainMarkersRef.current.entries()) {
      if (nextIds.has(id)) continue;
      marker.setMap(null);
      captainMarkersRef.current.delete(id);
    }
  }, [captains, hasUsableApiKey]);

  useEffect(() => {
    if (!hasUsableApiKey || !mapRef.current || !window.google || !geocoderRef.current) return;
    const map = mapRef.current;
    const geocoder = geocoderRef.current;
    const targetOrders = orders.slice(0, 6);
    const neededIds = new Set(targetOrders.map((o) => o.id));
    for (const [id, marker] of orderMarkersRef.current.entries()) {
      if (neededIds.has(id)) continue;
      marker.setMap(null);
      orderMarkersRef.current.delete(id);
    }
    for (const order of targetOrders) {
      const cached = geocodeCache.current.get(order.pickupAddress);
      if (cached) {
        let marker = orderMarkersRef.current.get(order.id);
        if (!marker) {
          marker = new window.google.maps.Marker({
            map,
            position: cached,
            label: { text: "P", color: "#fff", fontWeight: "700" },
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: "#1d4ed8",
              fillOpacity: 1,
              strokeColor: "#1d4ed8",
              strokeWeight: 2,
            },
          });
          orderMarkersRef.current.set(order.id, marker);
        } else {
          marker.setPosition(cached);
        }
        continue;
      }
      geocoder.geocode(
        { address: order.pickupAddress, componentRestrictions: { country: "IL" } },
        (res: any, status: string) => {
          if (status !== "OK" || !res?.[0]?.geometry?.location) return;
          const raw = { lat: res[0].geometry.location.lat(), lng: res[0].geometry.location.lng() };
          const loc = clampLatLng(raw.lat, raw.lng);
          geocodeCache.current.set(order.pickupAddress, loc);
        },
      );
    }
  }, [orders, hasUsableApiKey]);

  useEffect(() => {
    if (!hasUsableApiKey || !mapRef.current || !window.google || !geocoderRef.current || !directionsRendererRef.current) return;
    const geocoder = geocoderRef.current;
    const first = orders[0];
    if (!first) {
      directionsRendererRef.current.setDirections({ routes: [] });
      return;
    }
    const setRoute = (origin: { lat: number; lng: number }, destination: { lat: number; lng: number }) => {
      const svc = new window.google.maps.DirectionsService();
      svc.route(
        {
          origin,
          destination,
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (result: any, status: string) => {
          if (status === "OK" && result) directionsRendererRef.current?.setDirections(result);
        },
      );
    };
    const origin = geocodeCache.current.get(first.pickupAddress);
    const destination = geocodeCache.current.get(first.dropoffAddress);
    if (origin && destination) {
      setRoute(origin, destination);
      return;
    }
    geocoder.geocode({ address: first.pickupAddress, componentRestrictions: { country: "IL" } }, (o: any, os: string) => {
      if (os !== "OK" || !o?.[0]?.geometry?.location) return;
      const olRaw = { lat: o[0].geometry.location.lat(), lng: o[0].geometry.location.lng() };
      const ol = clampLatLng(olRaw.lat, olRaw.lng);
      geocodeCache.current.set(first.pickupAddress, ol);
      geocoder.geocode({ address: first.dropoffAddress, componentRestrictions: { country: "IL" } }, (d: any, ds: string) => {
        if (ds !== "OK" || !d?.[0]?.geometry?.location) return;
        const dlRaw = { lat: d[0].geometry.location.lat(), lng: d[0].geometry.location.lng() };
        const dl = clampLatLng(dlRaw.lat, dlRaw.lng);
        geocodeCache.current.set(first.dropoffAddress, dl);
        setRoute(ol, dl);
      });
    });
  }, [orders, hasUsableApiKey]);

  if (!hasUsableApiKey) {
    return (
      <div className="flex h-[calc(100vh-260px)] items-center justify-center rounded-2xl border border-card-border bg-white p-6 shadow-sm">
        <div className="max-w-lg text-center" dir="rtl">
          <h3 className="text-lg font-semibold text-foreground">خريطة Google غير مفعّلة</h3>
          <p className="mt-2 text-sm text-muted">
            أضف مفتاح Google Maps في VITE_GOOGLE_MAPS_API_KEY لتفعيل التتبع الحقيقي. عند التفعيل تُقيَّد الخريطة لعرض إسرائيل فقط.
          </p>
          <div className="mt-3 rounded-lg border border-card-border bg-slate-50 p-3 text-right text-xs text-slate-700">
            <p className="font-semibold">الملف المطلوب:</p>
            <p dir="ltr">apps/web/.env.local</p>
            <p className="mt-2 font-semibold">الصيغة:</p>
            <p dir="ltr">VITE_GOOGLE_MAPS_API_KEY=AIza...</p>
            <p className="mt-2">ثم أعد تشغيل السيرفر:</p>
            <p dir="ltr">npm run dev -w @captain/web</p>
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-[calc(100vh-260px)] items-center justify-center rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm" dir="rtl">
        <div className="max-w-lg text-center">
          <h3 className="text-lg font-semibold text-red-700">تعذّر تحميل Google Maps</h3>
          <p className="mt-2 text-sm text-red-700">{loadError}</p>
          <p className="mt-2 text-xs text-red-600">تحقق من صلاحية المفتاح وتفعيل Maps JavaScript API والفوترة وقيود referrer.</p>
        </div>
      </div>
    );
  }

  return <div ref={hostRef} className="h-[calc(100vh-260px)] w-full rounded-2xl border border-card-border shadow-sm" />;
}
