import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Platform, type AppStateStatus } from "react-native";
import * as Location from "expo-location";
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
import { useCaptainAssignment } from "@/hooks/api/use-captain-assignment";

const IS_TRACKING_RUNTIME_SUPPORTED = Platform.OS !== "web";

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
  /** Hooks must run unconditionally (web is unsupported but still mounts this hook). */
  const trackingSupported = IS_TRACKING_RUNTIME_SUPPORTED;

  const reachability = useNetworkReachability();
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const availabilityStatus = useAuthStore((s) => s.captain?.availabilityStatus);
  const assignmentQ = useCaptainAssignment({
    enabled: isAuthenticated && trackingSupported,
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
  });
  const hasActiveAssignment = assignmentQ.data?.state === "ACTIVE";
  const sessionEnabled =
    trackingSupported &&
    isAuthenticated &&
    (isAvailabilityOnlineForTracking(availabilityStatus) || hasActiveAssignment);
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
        // eslint-disable-next-line no-console
        console.info("[captain-location] permission-status", { granted: p === "granted", source: "request" });
      } else {
        setPermission("granted");
        // eslint-disable-next-line no-console
        console.info("[captain-location] permission-status", { granted: true, source: "cached" });
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
      // eslint-disable-next-line no-console
      console.info("[captain-location] update lat lng accuracy timestamp", {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: null,
        timestamp: new Date(now).toISOString(),
      });

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
        const ack = await sendCaptainLocationReliable({
          ...coords,
          heading: null,
          speed: null,
          accuracy: null,
          timestamp: new Date(now).toISOString(),
        });
        // eslint-disable-next-line no-console
        console.info("[captain-location] send-success", {
          latitude: coords.latitude,
          longitude: coords.longitude,
          mode: "tick",
        });
        setLastServerAck(ack);
        setLastIssue(null);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[captain-location] send-failed", { mode: "tick", error: e });
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

  /** حلقة fallback دورية بسيطة في حال تعثّر watchPosition */
  useEffect(() => {
    if (!sessionEnabled || !appForeground || permission !== "granted") {
      return;
    }
    const tick = () => void runTickRef.current();
    void tick();
    const id = setInterval(tick, TRACKING_CONFIG.intervalMsForeground);
    return () => clearInterval(id);
  }, [sessionEnabled, appForeground, permission]);

  /** Live foreground tracking stream */
  useEffect(() => {
    if (!sessionEnabled || !appForeground || permission !== "granted") return;

    let disposed = false;
    let inFlight = false;
    let sub: Location.LocationSubscription | null = null;
    // eslint-disable-next-line no-console
    console.info("[captain-location] watcher-started", {
      mode: "watchPositionAsync",
      availabilityStatus,
      intervalMs: TRACKING_CONFIG.intervalMsForeground,
      hasActiveAssignment,
    });

    void Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 10,
      },
      (pos) => {
        if (disposed || inFlight) return;
        inFlight = true;
        void (async () => {
          const now = Date.now();
          const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          const body = {
            ...coords,
            heading: Number.isFinite(pos.coords.heading as number) ? (pos.coords.heading as number) : null,
            speed: Number.isFinite(pos.coords.speed as number) ? (pos.coords.speed as number) : null,
            accuracy: Number.isFinite(pos.coords.accuracy as number) ? (pos.coords.accuracy as number) : null,
            timestamp: pos.timestamp ? new Date(pos.timestamp).toISOString() : new Date(now).toISOString(),
          };
          setLastFix({ ...coords, recordedAtMs: now });
          // eslint-disable-next-line no-console
          console.info("[captain-location] update lat lng accuracy timestamp", {
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: body.accuracy,
            timestamp: body.timestamp,
          });
          if (refs.current.reachability !== "online") {
            outboxRef.current.enqueue(coords);
            updatePending();
            setLastIssue({ kind: "network", message: i18n.t("tracking.issueNetworkOffline") });
            return;
          }
          try {
            const ack = await sendCaptainLocationReliable(body);
            // eslint-disable-next-line no-console
            console.info("[captain-location] send-success", {
              latitude: coords.latitude,
              longitude: coords.longitude,
              mode: "watch",
            });
            setLastServerAck(ack);
            setLastIssue(null);
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error("[captain-location] send-failed", { mode: "watch", error: e });
            outboxRef.current.enqueue(coords);
            updatePending();
            setLastIssue(classifySendFailure(e));
          }
        })().finally(() => {
          inFlight = false;
        });
      },
    )
      .then((s) => {
        sub = s;
      })
      .catch((e: unknown) => {
        setLastIssue({
          kind: "gps_unavailable",
          message: formatLocationError(e),
        });
      });

    return () => {
      disposed = true;
      sub?.remove();
      // eslint-disable-next-line no-console
      console.info("[captain-location] watcher-stopped", { availabilityStatus, hasActiveAssignment });
    };
  }, [sessionEnabled, appForeground, permission, availabilityStatus, hasActiveAssignment, updatePending]);

  /** عند عودة الشبكة — إفراغ الطابور */
  useEffect(() => {
    if (reachability === "online" && sessionEnabled && permission === "granted") {
      void flushOutbox();
    }
  }, [reachability, sessionEnabled, permission, flushOutbox]);

  const refreshPermission = useCallback(async () => {
    if (!trackingSupported) return;
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
  }, [trackingSupported]);

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
