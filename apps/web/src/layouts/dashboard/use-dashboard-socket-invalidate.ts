import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { queryKeys } from "@/lib/api/query-keys";
import { createDashboardSocket } from "@/lib/socket";

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
     * تحديث موقع الكابتن فقط — لا يغيّر قوائم الطلبات؛ يكفي الخريطة النشطة + سجل النشاط (يُسجَّل موقع في الخادم).
     * يقلّل الضغط عن التكرار مع `invalidateOrderDistributionDomain` بعد التعيين وعن إعادة جلب غير لازمة مع كل ping.
     */
    const bumpCaptainLocationOnly = (payload: unknown) => {
      // eslint-disable-next-line no-console
      console.info("[tracking-map] received", { event: "captain:location", payload });
      void qc.invalidateQueries({ queryKey: queryKeys.tracking.activeMap() });
      void qc.invalidateQueries({ queryKey: queryKeys.activity.root });
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
    socket.on("captain:location", bumpCaptainLocationOnly);
    return () => {
      socket.off("order:created", bumpOrderDomain);
      socket.off("order:updated", onOrderUpdated);
      socket.off("captain:location", bumpCaptainLocationOnly);
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
