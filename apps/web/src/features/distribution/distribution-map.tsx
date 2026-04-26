import { useCallback, useEffect, useRef, useState } from "react";
import type { ActiveMapCaptain } from "@/types/api";
import {
  buildCaptainPopupElement,
  DISPATCH_QUICK_ALERT_TYPE,
  QUICK_ALERT_PRESET_COPY,
  type QuickAlertPreset,
} from "@/features/distribution/build-captain-map-popup";
import { assignmentOfferSecondsLeft, captainMapVisual } from "@/features/distribution/captain-map-visual";
import { clampLatLng, clampLatLngPair, ISRAEL_LEAFLET_MAX_BOUNDS } from "@/lib/israel-map-bounds";
import { api } from "@/lib/api/singleton";
import { toast, toastApiError, toastSuccess } from "@/lib/toast";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

/** يحدد مستلم الإشعار من active-map إن وُجد؛ وإلا `null` (يُكمّل عبر GET /captains/:id). */
function resolveCaptainTargetUserIdFromMapPayload(c: ActiveMapCaptain): string | null {
  const top = c.userId?.trim();
  if (top) return top;
  const nested = c.user?.id?.trim();
  if (nested) return nested;
  return null;
}

type DistributionMapProps = {
  captains: ActiveMapCaptain[];
  /** عند الإفلات على كابتن */
  onAssignDrop: (orderId: string, captainId: string) => void;
  /** تسليط الضوء على كابتن أثناء السحب */
  draggingOrderId: string | null;
  /** مركز الخريطة عند عدم وجود كباتن أو بعد التحميل — من إعدادات اللوحة أو الافتراضي. */
  defaultCenter: [number, number];
  defaultZoom: number;
  /**
   * When present: drop on a marker is allowed only if this returns true (e.g. supervisor-linked store + roster match).
   * Omitted: all drops are attempted (server validates).
   */
  dropAllow?: (orderId: string, captainId: string) => boolean;
  onDropRejectedByGuard?: () => void;
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
  options?: {
    allow?: (orderId: string, captainId: string) => boolean;
    onDisallowed?: () => void;
    /** Browsers often omit `getData` until `drop` — use the list’s current drag id when set. */
    activeDragOrderId: string | null;
  },
) {
  if (!el || !(el instanceof HTMLElement)) return;
  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    const fromDt = (e.dataTransfer?.getData("application/x-order-id") || e.dataTransfer?.getData("text/plain") || "")
      .trim();
    const orderId = (options?.activeDragOrderId || fromDt || null) as string | null;
    if (e.dataTransfer) {
      const ok = !orderId || !options?.allow || options.allow(orderId, captainId);
      e.dataTransfer.dropEffect = ok ? "copy" : "none";
    }
    if (orderId && options?.allow && !options.allow(orderId, captainId)) {
      el.classList.remove("ring-2", "ring-primary", "ring-offset-2");
      return;
    }
    el.classList.add("ring-2", "ring-primary", "ring-offset-2");
  };
  const onDragLeave = () => {
    el.classList.remove("ring-2", "ring-primary", "ring-offset-2");
  };
  const onDropEv = (e: DragEvent) => {
    e.preventDefault();
    el.classList.remove("ring-2", "ring-primary", "ring-offset-2");
    const orderId = e.dataTransfer?.getData("application/x-order-id") || e.dataTransfer?.getData("text/plain");
    if (!orderId) return;
    if (options?.allow && !options.allow(orderId, captainId)) {
      options.onDisallowed?.();
      return;
    }
    onDrop(orderId, captainId);
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

/** Runs a camera change without marking it as user-driven (drag/zoom). */
function runProgrammaticCamera(map: L.Map, fn: () => void, programmaticRef: { current: boolean }) {
  programmaticRef.current = true;
  try {
    fn();
  } finally {
    const clear = () => {
      programmaticRef.current = false;
    };
    map.once("moveend", clear);
    /** If the view doesn’t change, Leaflet may not emit `moveend` — avoid stuck programmatic flag. */
    window.setTimeout(clear, 400);
  }
}

export function DistributionMap({
  captains,
  onAssignDrop,
  draggingOrderId,
  defaultCenter,
  defaultZoom,
  dropAllow,
  onDropRejectedByGuard,
}: DistributionMapProps) {
  /** User panned/zoomed — block automatic camera from polling/countdown/settings. */
  const [userHasMovedMap, setUserHasMovedMap] = useState(false);
  /** When true, each captains update refits bounds (optional live follow). */
  const [autoFollowEnabled, setAutoFollowEnabled] = useState(false);

  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const cleanupsRef = useRef<Array<() => void>>([]);
  const programmaticCameraRef = useRef(false);
  /** One-time fit to all captains with locations (initial load). */
  const hasInitialFitRunRef = useRef(false);
  /** بطاقة كابتن مربوطة بالخريطة وليس بالعلامة — لا تُزال عند إعادة رسم الطبقة كل ثانية. */
  const captainPopupRef = useRef<L.Popup | null>(null);
  /** مصدر الحقيقة لفتح/إغلاق البطاقة — لا يعتمد على hover. */
  const [selectedCaptainId, setSelectedCaptainId] = useState<string | null>(null);

  const sendQuickAlertPreset = useCallback(async (c: ActiveMapCaptain, preset: QuickAlertPreset) => {
    const fromMap = resolveCaptainTargetUserIdFromMapPayload(c);
    // Always log at click time — يساعد على مطابقة بيانات التشغيل مع الكود دون الاعتماد على وضع DEV
    // eslint-disable-next-line no-console
    console.info("[otlob:distribution:quickAlert] click", {
      captainId: c.id,
      "c.userId": c.userId,
      "c.user?.id": c.user?.id,
      resolvedFromActiveMapPayload: fromMap,
      topLevelKeys: c && typeof c === "object" ? Object.keys(c) : [],
      captainJson: JSON.stringify(c),
    });

    let targetUserId = fromMap;
    if (!targetUserId) {
      // eslint-disable-next-line no-console
      console.warn(
        "[otlob:distribution:quickAlert] active-map payload missing user id — fetching GET /api/v1/captains/:id",
        { captainId: c.id },
      );
      try {
        const detail = await api.captains.get(c.id);
        targetUserId = detail.user?.id?.trim() ?? null;
        // eslint-disable-next-line no-console
        console.info("[otlob:distribution:quickAlert] GET /captains/:id result", {
          captainId: detail.id,
          "detail.user.id": detail.user?.id,
          resolvedAfterFallback: targetUserId,
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[otlob:distribution:quickAlert] GET /captains/:id failed", e);
        toastApiError(e, "تعذّر جلب بيانات الكابتن لإرسال التنبيه");
        return;
      }
    }

    if (!targetUserId) {
      // eslint-disable-next-line no-console
      console.error("[otlob:distribution:quickAlert] early exit: no target user id after map + fallback", {
        captainId: c.id,
      });
      toast.error(
        "لا يمكن تحديد حساب الكابتن لإرسال التنبيه. تأكد أن الخادم محدّث وأن الطلب GET /api/v1/captains يعمل.",
      );
      return;
    }

    const copy = QUICK_ALERT_PRESET_COPY[preset];
    const payload = {
      userId: targetUserId,
      type: DISPATCH_QUICK_ALERT_TYPE,
      title: copy.title,
      message: copy.message,
    };
    // eslint-disable-next-line no-console
    console.info("[otlob:distribution:quickAlert] POST /api/v1/notifications", payload);

    try {
      const created = await api.notifications.create(payload);
      // eslint-disable-next-line no-console
      console.info("[otlob:distribution:quickAlert] notification created", created);
      toastSuccess("تم إرسال التنبيه — سيظهر في إشعارات تطبيق الكابتن");
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[otlob:distribution:quickAlert] POST failed", e);
      toastApiError(e, "تعذّر إرسال التنبيه");
    }
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const maxBounds = L.latLngBounds(ISRAEL_LEAFLET_MAX_BOUNDS);
    const map = L.map(host, {
      zoomControl: true,
      maxBounds,
      maxBoundsViscosity: 1,
    }).setView(clampLatLngPair(defaultCenter), defaultZoom);
    mapRef.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    }).addTo(map);

    const group = L.layerGroup().addTo(map);
    layerRef.current = group;

    const captainPopup = L.popup({
      autoPan: false,
      keepInView: false,
      closeButton: true,
      className: "distribution-captain-popup",
      maxWidth: 248,
      /** لا إغلاق تلقائي عند النقر خارجاً — نتحكم يدوياً حتى لا تختفي البطاقة عند تحديث الطبقة */
      autoClose: false,
      closeOnClick: false,
    });
    captainPopupRef.current = captainPopup;

    const onPopupCloseMap = (ev: L.LeafletEvent) => {
      const pe = ev as L.LeafletEvent & { popup?: L.Popup };
      if (pe.popup === captainPopupRef.current) {
        setSelectedCaptainId(null);
      }
    };
    map.on("popupclose", onPopupCloseMap);

    const onMapClickForPopup = (e: L.LeafletMouseEvent) => {
      const t = e.originalEvent?.target as HTMLElement | undefined;
      if (t?.closest?.(".leaflet-popup")) return;
      map.closePopup();
    };
    map.on("click", onMapClickForPopup);

    const markUserInteraction = () => {
      if (!programmaticCameraRef.current) {
        setUserHasMovedMap(true);
      }
    };
    map.on("dragend", markUserInteraction);
    map.on("zoomend", markUserInteraction);

    return () => {
      map.off("popupclose", onPopupCloseMap);
      map.off("click", onMapClickForPopup);
      map.off("dragend", markUserInteraction);
      map.off("zoomend", markUserInteraction);
      captainPopupRef.current = null;
      cleanupsRef.current.forEach((fn) => fn());
      cleanupsRef.current = [];
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Dashboard default center/zoom from settings — only while we haven’t framed captains yet.
   * After `hasInitialFitRunRef` (fit to markers), do not override camera from settings refreshes.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || userHasMovedMap) return;
    if (hasInitialFitRunRef.current) return;
    runProgrammaticCamera(
      map,
      () => {
        map.setView(clampLatLngPair(defaultCenter), defaultZoom);
      },
      programmaticCameraRef,
    );
  }, [defaultCenter[0], defaultCenter[1], defaultZoom, userHasMovedMap]);

  /** Markers + popups only — never moves the camera (fixes 1s countdown + polling snap-back). */
  useEffect(() => {
    const map = mapRef.current;
    const group = layerRef.current;
    if (!map || !group) return;

    cleanupsRef.current.forEach((fn) => fn());
    cleanupsRef.current = [];
    group.clearLayers();

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
        <div style="display:flex;flex-direction:column;align-items:center;min-width:46px" title="${vis.label.replace(/"/g, "&quot;")}">
        <div class="distribution-map-marker ${pulseClass}" style="
          width:34px;height:34px;border-radius:9999px;
          border:2px solid ${vis.border};background:${vis.bg};
          display:flex;align-items:center;justify-content:center;
          font-size:17px;line-height:1;box-shadow:0 2px 6px rgba(0,0,0,.18);
        ">${glyph}</div>${countdownLine}</div>`;

      const icon = L.divIcon({
        className: "distribution-map-marker-wrap",
        html,
        iconSize: [48, 52],
        iconAnchor: [24, 46],
        popupAnchor: [0, -42],
      });

      const cl = clampLatLng(loc.latitude, loc.longitude);
      const marker = L.marker([cl.lat, cl.lng], { icon });
      marker.on("click", (ev: L.LeafletMouseEvent) => {
        ev.originalEvent?.stopPropagation();
        setSelectedCaptainId(c.id);
      });
      marker.addTo(group);

      const el = marker.getElement() ?? null;
      const cleanup = bindDropTarget(el, c.id, onAssignDrop, {
        allow: dropAllow,
        onDisallowed: onDropRejectedByGuard,
        activeDragOrderId: draggingOrderId,
      });
      if (cleanup) cleanupsRef.current.push(cleanup);
    }
  }, [captains, onAssignDrop, dropAllow, onDropRejectedByGuard, draggingOrderId]);

  /**
   * بطاقة واحدة على الخريطة (ليست على العلامة) — لا تُزال عند `clearLayers`.
   * التحديث من `selectedCaptainId` + `captains` دون إغلاق عند كل poll.
   */
  useEffect(() => {
    const map = mapRef.current;
    const popup = captainPopupRef.current;
    if (!map || !popup) return;

    if (!selectedCaptainId) {
      map.closePopup();
      return;
    }

    const c = captains.find((x) => x.id === selectedCaptainId);
    if (!c || !c.lastLocation) {
      setSelectedCaptainId(null);
      return;
    }

    const cl = clampLatLng(c.lastLocation.latitude, c.lastLocation.longitude);
    popup.setLatLng([cl.lat, cl.lng]);
    popup.setContent(buildCaptainPopupElement(c, { sendQuickAlertPreset }));
    popup.openOn(map);
    /** لا مؤقت 1 Hz هنا — DOM البطاقة يتحدث مع `captains` / الاختيار فقط (قائمة التواصل تبقى مستقرة). */
  }, [selectedCaptainId, captains, sendQuickAlertPreset]);

  const fitToCaptainsOrDefault = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const withLoc = captains.filter((c) => c.lastLocation);
    runProgrammaticCamera(
      map,
      () => {
        if (withLoc.length > 0) {
          const pts = withLoc.map((c) => clampLatLngPair([c.lastLocation!.latitude, c.lastLocation!.longitude]));
          if (pts.length === 1) {
            map.setView(pts[0]!, 12);
          } else {
            map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 14 });
          }
        } else {
          map.setView(clampLatLngPair(defaultCenter), defaultZoom);
        }
      },
      programmaticCameraRef,
    );
  }, [captains, defaultCenter, defaultZoom]);

  /** Initial auto-fit once when we first have captain locations (not on every poll tick). */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || userHasMovedMap || hasInitialFitRunRef.current) return;
    const withLoc = captains.filter((c) => c.lastLocation);
    if (withLoc.length === 0) return;
    runProgrammaticCamera(
      map,
      () => {
        const pts = withLoc.map((c) => clampLatLngPair([c.lastLocation!.latitude, c.lastLocation!.longitude]));
        if (pts.length === 1) {
          map.setView(pts[0]!, 12);
        } else {
          map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 14 });
        }
      },
      programmaticCameraRef,
    );
    hasInitialFitRunRef.current = true;
  }, [captains, userHasMovedMap]);

  /**
   * Live follow: when enabled and the user hasn’t taken over the camera, refit on each captains poll.
   * Disabled while `userHasMovedMap` — use «إعادة التمركز» or re-enable «تتبع تلقائي».
   */
  useEffect(() => {
    if (!autoFollowEnabled || userHasMovedMap) return;
    const map = mapRef.current;
    if (!map) return;
    const withLoc = captains.filter((c) => c.lastLocation);
    if (withLoc.length === 0) return;
    runProgrammaticCamera(
      map,
      () => {
        const pts = withLoc.map((c) => clampLatLngPair([c.lastLocation!.latitude, c.lastLocation!.longitude]));
        if (pts.length === 1) {
          map.setView(pts[0]!, 12);
        } else {
          map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 14 });
        }
      },
      programmaticCameraRef,
    );
  }, [autoFollowEnabled, captains, userHasMovedMap]);

  const handleRecenter = useCallback(() => {
    setUserHasMovedMap(false);
    hasInitialFitRunRef.current = true;
    fitToCaptainsOrDefault();
  }, [fitToCaptainsOrDefault]);

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
        .leaflet-popup.distribution-captain-popup .leaflet-popup-content-wrapper {
          border-radius: 10px;
          overflow: visible;
        }
        .leaflet-popup.distribution-captain-popup .leaflet-popup-content {
          margin: 6px 8px;
          overflow: visible;
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
        <div className="flex flex-wrap items-center gap-2 [direction:rtl]">
          <label className="flex cursor-pointer items-center gap-2 text-[11px] text-muted">
            <input
              type="checkbox"
              className="rounded border-card-border"
              checked={autoFollowEnabled}
              onChange={(e) => {
                const on = e.target.checked;
                setAutoFollowEnabled(on);
                if (on) setUserHasMovedMap(false);
              }}
            />
            تتبع تلقائي (تحديث الكاميرا مع البيانات)
          </label>
          <button
            type="button"
            className="rounded-md border border-card-border bg-background px-2.5 py-1.5 text-xs font-semibold text-foreground shadow-sm hover:bg-muted/50"
            onClick={handleRecenter}
          >
            إعادة التمركز
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 border-b border-card-border bg-card/80 px-4 py-2 text-[11px] text-muted [direction:rtl]">
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
      <div ref={hostRef} className="h-[calc(100vh-280px)] min-h-[360px] w-full" />
    </div>
  );
}
