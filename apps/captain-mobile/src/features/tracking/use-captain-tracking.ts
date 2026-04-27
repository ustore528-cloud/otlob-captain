import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import i18n from "@/i18n/i18n";
import { useAuthStore, selectIsAuthenticated } from "@/store/auth-store";
import type { CaptainLocationRecordDto } from "@/services/api/dto";
import { TRACKING_CONFIG } from "./config";
import { classifySendFailure } from "./error-classify";
import { formatLocationError, readCurrentPosition } from "./location-read";
import { useNetworkReachability } from "./network";
import { LocationOutbox } from "./outbox";
import { getForegroundPermissionState, requestForegroundPermission } from "./permission";
import { sendCaptainLocationReliable } from "./sender";
import type { CaptainTrackingSnapshot, ForegroundPermissionState, TrackingIssue } from "./types";

type TrackingRefs = {
  sessionEnabled: boolean;
  permission: ForegroundPermissionState;
  reachability: CaptainTrackingSnapshot["reachability"];
  appForeground: boolean;
};

export type UseCaptainTrackingResult = {
  snapshot: CaptainTrackingSnapshot;
  /** إعادة طلب الصلاحية (بعد رفض سابق قد يحتاج إعدادات النظام) */
  refreshPermission: () => Promise<void>;
};

function isAvailabilityOnlineForTracking(availability: string | undefined | null): boolean {
  if (availability == null) return false;
  return String(availability) !== "OFFLINE";
}
function buildSnapshot(
  base: Omit<CaptainTrackingSnapshot, "pendingInOutbox"> & { pendingInOutbox?: number },
): CaptainTrackingSnapshot {
  return {
    sessionEnabled: base.sessionEnabled,
    permission: base.permission,
    reachability: base.reachability,
    appInForeground: base.appInForeground,
    lastFix: base.lastFix,
    lastServerAck: base.lastServerAck,
    pendingInOutbox: base.pendingInOutbox ?? 0,
    lastIssue: base.lastIssue,
  };
}

/**
 * تتبع الموقع في المقدّمة: فترة ثابتة، إرسال للخادم، طابور عند انقطاع الشبكة، إعادة محاولة.
 * الجلسة مفعّلة تلقائيًا عندما يكون التوفر ليس «غير متصل» (OFFLINE) — مثل مفتاح التوفر في الصفحة الرئيسية.
 */
export function useCaptainTrackingState(): UseCaptainTrackingResult {
  const reachability = useNetworkReachability();
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const availabilityStatus = useAuthStore((s) => s.captain?.availabilityStatus);
  const sessionEnabled = isAuthenticated && isAvailabilityOnlineForTracking(availabilityStatus);
  const [permission, setPermission] = useState<ForegroundPermissionState>("unknown");
  const [appForeground, setAppForeground] = useState(true);
  const [lastFix, setLastFix] = useState<CaptainTrackingSnapshot["lastFix"]>(null);
  const [lastServerAck, setLastServerAck] = useState<CaptainLocationRecordDto | null>(null);
  const [lastIssue, setLastIssue] = useState<TrackingIssue | null>(null);
  const [pendingInOutbox, setPendingInOutbox] = useState(0);

  const outboxRef = useRef(new LocationOutbox());
  const refs = useRef<TrackingRefs>({
    sessionEnabled: false,
    permission: "unknown",
    reachability: "unknown",
    appForeground: true,
  });

  refs.current = {
    sessionEnabled,
    permission,
    reachability,
    appForeground,
  };

  useEffect(() => {
    const onChange = (s: AppStateStatus) => {
      setAppForeground(s === "active");
    };
    const sub = AppState.addEventListener("change", onChange);
    return () => sub.remove();
  }, []);

  /** عند تفعيل الجلسة: جلب الصلاحية ثم الطلب إن لزم */
  useEffect(() => {
    if (!sessionEnabled) return;
    void (async () => {
      let p = await getForegroundPermissionState();
      if (p !== "granted") {
        p = await requestForegroundPermission();
        setPermission(p);
      } else {
        setPermission("granted");
      }
      if (p === "granted") {
        setLastIssue((prev) => (prev?.kind === "permission_denied" ? null : prev));
      } else {
        setLastIssue({
          kind: "permission_denied",
          message: i18n.t("tracking.issuePermissionForeground"),
        });
      }
    })();
  }, [sessionEnabled]);

  const updatePending = useCallback(() => {
    setPendingInOutbox(outboxRef.current.size());
  }, []);

  const flushOutbox = useCallback(async () => {
    if (refs.current.reachability !== "online") return;
    while (outboxRef.current.size() > 0) {
      const body = outboxRef.current.peek();
      if (!body) break;
      try {
        const ack = await sendCaptainLocationReliable(body);
        outboxRef.current.shift();
        setLastServerAck(ack);
        setLastIssue(null);
        updatePending();
      } catch {
        break;
      }
    }
  }, [updatePending]);

  const tickInFlight = useRef(false);
  const runTick = useCallback(async () => {
    if (tickInFlight.current) return;
    const { sessionEnabled: on, permission: perm, appForeground: fg } = refs.current;
    if (!on || !fg || perm !== "granted") return;

    tickInFlight.current = true;
    try {
      await flushOutbox();

      let coords: { latitude: number; longitude: number };
      try {
        coords = await readCurrentPosition();
      } catch (e) {
        const msg = formatLocationError(e);
        setLastIssue({ kind: "gps_unavailable", message: msg });
        return;
      }

      const now = Date.now();
      setLastFix({ latitude: coords.latitude, longitude: coords.longitude, recordedAtMs: now });

      if (refs.current.reachability !== "online") {
        outboxRef.current.enqueue(coords);
        updatePending();
        setLastIssue({
          kind: "network",
          message: i18n.t("tracking.issueNetworkOffline"),
        });
        return;
      }

      try {
        const ack = await sendCaptainLocationReliable(coords);
        setLastServerAck(ack);
        setLastIssue(null);
      } catch (e) {
        outboxRef.current.enqueue(coords);
        updatePending();
        setLastIssue(classifySendFailure(e));
      }
    } finally {
      tickInFlight.current = false;
    }
  }, [flushOutbox, updatePending]);

  const runTickRef = useRef(runTick);
  runTickRef.current = runTick;

  /** حلقة التقطيع — يعتمد على مرجع مستقر لتفادي إعادة جدولة المؤقت بلا داعٍ */
  useEffect(() => {
    if (!sessionEnabled || !appForeground || permission !== "granted") {
      return;
    }
    const tick = () => void runTickRef.current();
    void tick();
    const id = setInterval(tick, TRACKING_CONFIG.intervalMsForeground);
    return () => clearInterval(id);
  }, [sessionEnabled, appForeground, permission]);

  /** عند عودة الشبكة — إفراغ الطابور */
  useEffect(() => {
    if (reachability === "online" && sessionEnabled && permission === "granted") {
      void flushOutbox();
    }
  }, [reachability, sessionEnabled, permission, flushOutbox]);

  const refreshPermission = useCallback(async () => {
    const p = await requestForegroundPermission();
    setPermission(p);
    if (p === "granted") {
      setLastIssue(null);
    } else {
      setLastIssue({
        kind: "permission_denied",
        message: i18n.t("tracking.issuePermissionDeniedSettings"),
      });
    }
  }, []);

  const snapshot = useMemo(
    () =>
      buildSnapshot({
        sessionEnabled,
        permission,
        reachability,
        appInForeground: appForeground,
        lastFix,
        lastServerAck,
        pendingInOutbox,
        lastIssue,
      }),
    [sessionEnabled, permission, reachability, appForeground, lastFix, lastServerAck, pendingInOutbox, lastIssue],
  );

  return {
    snapshot,
    refreshPermission,
  };
}
