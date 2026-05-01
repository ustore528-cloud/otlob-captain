import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Platform, type AppStateStatus } from "react-native";
import i18n from "@/i18n/i18n";
import { useAuthStore, selectIsAuthenticated } from "@/store/auth-store";
import type { CaptainLocationRecordDto, UpdateCaptainLocationBody } from "@/services/api/dto";
import { TRACKING_CONFIG } from "./config";
import { classifySendFailure } from "./error-classify";
import { distanceMeters } from "./geo-distance";
import { formatLocationError, readCurrentPositionForTracking } from "./location-read";
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
  const hasActiveAssignmentRef = useRef(hasActiveAssignment);
  hasActiveAssignmentRef.current = hasActiveAssignment;
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
  /** آخر نقطة أُرسِمت بنجاح — لتخطّي الإرسال عندما لا يوجد طلب نشط وتغيّر طفيف. */
  const lastSentCoordsRef = useRef<{ latitude: number; longitude: number } | null>(null);

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
        lastSentCoordsRef.current = { latitude: body.latitude, longitude: body.longitude };
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

      let body: UpdateCaptainLocationBody;
      try {
        body = await readCurrentPositionForTracking();
      } catch (e) {
        const msg = formatLocationError(e);
        setLastIssue({ kind: "gps_unavailable", message: msg });
        return;
      }

      const coords = { latitude: body.latitude, longitude: body.longitude };
      const nowMs = Date.now();
      setLastFix({ latitude: coords.latitude, longitude: coords.longitude, recordedAtMs: nowMs });
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.info("[captain-location-tracker] sampled", {
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: body.accuracy,
          timestamp: body.timestamp,
        });
      }

      const activeNow = hasActiveAssignmentRef.current;
      if (
        !activeNow &&
        lastSentCoordsRef.current &&
        distanceMeters(coords, lastSentCoordsRef.current) < TRACKING_CONFIG.minMovementSkipMeters
      ) {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.info("[captain-location-tracker] skip-near-copy", {
            meters: distanceMeters(coords, lastSentCoordsRef.current),
          });
        }
        return;
      }

      if (refs.current.reachability !== "online") {
        outboxRef.current.enqueue(body);
        updatePending();
        setLastIssue({
          kind: "network",
          message: i18n.t("tracking.issueNetworkOffline"),
        });
        return;
      }

      try {
        const ack = await sendCaptainLocationReliable(body);
        lastSentCoordsRef.current = coords;
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.info("[captain-location-tracker] sent", {
            latitude: coords.latitude,
            longitude: coords.longitude,
          });
        }
        setLastServerAck(ack);
        setLastIssue(null);
      } catch (e) {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.info("[captain-location-tracker] failed", { mode: "tick", error: e });
        }
        outboxRef.current.enqueue(body);
        updatePending();
        setLastIssue(classifySendFailure(e));
      }
    } finally {
      tickInFlight.current = false;
    }
  }, [flushOutbox, updatePending]);

  const runTickRef = useRef(runTick);
  runTickRef.current = runTick;

  /** دورة وحيدة كل 3 ثوانٍ (مقدّمة + متصل بالخادم) — بديل موحِّد عن watchPosition لتفادي بطء التحديث */
  useEffect(() => {
    if (!sessionEnabled || !appForeground || permission !== "granted") {
      return;
    }
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.info("[captain-location-tracker] started", { intervalMs: TRACKING_CONFIG.intervalMsForeground });
    }
    const tick = () => void runTickRef.current();
    void tick();
    const id = setInterval(tick, TRACKING_CONFIG.intervalMsForeground);
    return () => {
      clearInterval(id);
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.info("[captain-location-tracker] stopped");
      }
    };
  }, [sessionEnabled, appForeground, permission]);

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
