import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { queryKeys } from "@/lib/api/query-keys";
import { createDashboardSocket } from "@/lib/socket";
import type { ActiveMapCaptain } from "@/types/api";

function parseCaptainLocationPayload(raw: unknown): {
  captainId: string;
  latitude: number;
  longitude: number;
  recordedAt: string;
} | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const captainId = typeof o.captainId === "string" ? o.captainId : null;
  const latitude = typeof o.latitude === "number" && Number.isFinite(o.latitude) ? o.latitude : null;
  const longitude = typeof o.longitude === "number" && Number.isFinite(o.longitude) ? o.longitude : null;
  if (!captainId || latitude === null || longitude === null) return null;
  const recordedAt = typeof o.recordedAt === "string" ? o.recordedAt : new Date().toISOString();
  return { captainId, latitude, longitude, recordedAt };
}

function mergeCaptainLocationOnActiveMap(
  prev: ActiveMapCaptain[] | undefined,
  p: NonNullable<ReturnType<typeof parseCaptainLocationPayload>>,
): ActiveMapCaptain[] | undefined {
  if (!prev?.length) return prev;
  const idx = prev.findIndex((c) => c.id === p.captainId);
  if (idx === -1) return prev;
  const next = [...prev];
  const row = next[idx];
  next[idx] = {
    ...row,
    lastLocation: {
      captainId: p.captainId,
      latitude: p.latitude,
      longitude: p.longitude,
      recordedAt: p.recordedAt,
    },
  };
  return next;
}

/** إبطال ذاكرة React Query عند أحداث Socket.IO للوحة التشغيل */
export function useDashboardSocketInvalidate(token: string | null) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!token) return;
    const socket = createDashboardSocket(token);
    /** Order create/update — lists، الكباتن، الإحصاء، الخريطة، وما يرتبط بالطلبات في اللوحة. */
    const bumpOrderDomain = () => {
      void qc.invalidateQueries({ queryKey: queryKeys.orders.root });
      void qc.invalidateQueries({ queryKey: queryKeys.captains.root });
      void qc.invalidateQueries({ queryKey: queryKeys.users.root });
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard.stats() });
      void qc.invalidateQueries({ queryKey: queryKeys.tracking.activeMap() });
      void qc.invalidateQueries({ queryKey: queryKeys.notifications.root });
      void qc.invalidateQueries({ queryKey: queryKeys.activity.root });
      void qc.invalidateQueries({ queryKey: queryKeys.stores.root });
    };
    /**
     * موقع الكابتن من Socket — دمج في كاش الخريطة النشطة لتقليل refetch عند pings كل ثوانٍ.
     */
    const onCaptainLocationSocket = (payload: unknown) => {
      // eslint-disable-next-line no-console
      console.info("[tracking-map] received", { events: ["captain:location", "captain:location:update"], payload });
      const parsed = parseCaptainLocationPayload(payload);
      if (!parsed) {
        void qc.invalidateQueries({ queryKey: queryKeys.tracking.activeMap() });
        return;
      }
      const mapKey = queryKeys.tracking.activeMap();
      const cur = qc.getQueryData<ActiveMapCaptain[]>(mapKey);
      const merged = mergeCaptainLocationOnActiveMap(cur, parsed);
      if (merged === undefined) {
        void qc.invalidateQueries({ queryKey: mapKey });
        return;
      }
      qc.setQueryData(mapKey, merged);
    };
    socket.on("order:created", bumpOrderDomain);
    const onOrderUpdated = (payload: unknown) => {
      const t = performance.now();
      const id =
        typeof payload === "object" && payload !== null && "id" in payload && typeof (payload as { id: unknown }).id === "string"
          ? (payload as { id: string }).id
          : null;
      const last = typeof window !== "undefined" ? window.__OTLOB_LAST_ASSIGN : undefined;
      let msAfterMutationInvalidate: number | undefined;
      if (last && id === last.orderId) {
        msAfterMutationInvalidate = t - last.invalidateCompletedAt;
      }
      // eslint-disable-next-line no-console
      console.info("[otlob:socket-timing] order:updated", {
        t,
        orderId: id,
        msAfterMutationInvalidate,
        overlapDuplicateRefresh: last && id === last.orderId && msAfterMutationInvalidate != null && msAfterMutationInvalidate > -50,
        payload,
      });
      bumpOrderDomain();
    };
    socket.on("order:updated", onOrderUpdated);
    socket.on("captain:location", onCaptainLocationSocket);
    socket.on("captain:location:update", onCaptainLocationSocket);
    return () => {
      socket.off("order:created", bumpOrderDomain);
      socket.off("order:updated", onOrderUpdated);
      socket.off("captain:location", onCaptainLocationSocket);
      socket.off("captain:location:update", onCaptainLocationSocket);
      /**
       * Defer disconnect to the next microtask so we don’t abort a transport mid-handshake.
       * React 18 Strict Mode runs mount → cleanup → mount in dev; immediate disconnect caused noisy warnings.
       */
      const s = socket;
      queueMicrotask(() => {
        try {
          s.disconnect();
        } catch {
          /* ignore */
        }
      });
    };
  }, [token, qc]);
}
