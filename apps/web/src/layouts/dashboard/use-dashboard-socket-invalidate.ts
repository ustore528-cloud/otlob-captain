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
    const bump = () => {
      void qc.invalidateQueries({ queryKey: queryKeys.orders.root });
      void qc.invalidateQueries({ queryKey: queryKeys.captains.root });
      void qc.invalidateQueries({ queryKey: queryKeys.users.root });
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard.root });
      void qc.invalidateQueries({ queryKey: queryKeys.tracking.root });
      void qc.invalidateQueries({ queryKey: queryKeys.notifications.root });
      void qc.invalidateQueries({ queryKey: queryKeys.activity.root });
      void qc.invalidateQueries({ queryKey: queryKeys.stores.root });
    };
    socket.on("order:created", bump);
    socket.on("order:updated", bump);
    socket.on("captain:location", bump);
    return () => {
      socket.off("order:created", bump);
      socket.off("order:updated", bump);
      socket.off("captain:location", bump);
      socket.disconnect();
    };
  }, [qc, token]);
}
