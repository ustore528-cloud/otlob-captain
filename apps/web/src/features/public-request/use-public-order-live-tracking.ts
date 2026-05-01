import { useCallback, useEffect, useRef, useState } from "react";
import { createPublicOrderPageSocket } from "@/lib/socket-public-tracking";

const FALLBACK_POLL_MS = 12_500;

export type CustomerOrderStatusChangedPayload = {
  trackingToken: string;
  status: string;
  statusLabelKey: string;
  messageKey: string;
  updatedAt: string;
};

function parseCustomerPayload(raw: unknown): CustomerOrderStatusChangedPayload | null {
  if (typeof raw !== "object" || raw === null) return null;
  const rec = raw as Record<string, unknown>;
  const trackingToken = typeof rec.trackingToken === "string" ? rec.trackingToken.trim() : "";
  const status = typeof rec.status === "string" ? rec.status.trim() : "";
  const statusLabelKey = typeof rec.statusLabelKey === "string" ? rec.statusLabelKey.trim() : "";
  const messageKey = typeof rec.messageKey === "string" ? rec.messageKey.trim() : "";
  const updatedAt = typeof rec.updatedAt === "string" ? rec.updatedAt.trim() : "";
  if (!trackingToken || !status || !statusLabelKey || !messageKey || !updatedAt) return null;
  return { trackingToken, status, statusLabelKey, messageKey, updatedAt };
}

/** Socket.IO + fallback poll (~12s) when disconnected (صفحة عميل `/request`). */
export function usePublicOrderLiveTracking(args: {
  trackingToken: string | null;
  poll: () => void | Promise<void>;
  enabled: boolean;
  onCustomerOrderStatusChanged?: (payload: CustomerOrderStatusChangedPayload) => void;
}): {
  socketConnected: boolean;
  usingPollingFallback: boolean;
} {
  const [socketConnected, setSocketConnected] = useState(false);
  const pollRef = useRef(args.poll);
  pollRef.current = args.poll;
  const onRemoteRef = useRef(args.onCustomerOrderStatusChanged);
  onRemoteRef.current = args.onCustomerOrderStatusChanged;

  const pollStable = useCallback(() => void pollRef.current(), []);

  useEffect(() => {
    if (!args.enabled || !args.trackingToken) {
      setSocketConnected(false);
      return;
    }
    let cancelled = false;
    const socket = createPublicOrderPageSocket();
    const trackingToken = args.trackingToken;

    const requestJoin = () => {
      socket.emit("customer:join_order", { trackingToken });
    };

    const onConnected = () => {
      if (cancelled) return;
      setSocketConnected(true);
      requestJoin();
    };

    const onDisconnectedLike = () => {
      if (!cancelled) setSocketConnected(false);
    };

    const onStatusChanged = (raw: unknown) => {
      const payload = parseCustomerPayload(raw);
      if (!payload) return;
      if (payload.trackingToken !== trackingToken) return;
      void pollStable();
      onRemoteRef.current?.(payload);
    };

    if (socket.connected) onConnected();
    socket.on("connect", onConnected);
    socket.on("disconnect", onDisconnectedLike);
    socket.on("connect_error", onDisconnectedLike);
    socket.on("customer:order_status_changed", onStatusChanged);

    return () => {
      cancelled = true;
      socket.off("connect", onConnected);
      socket.off("disconnect", onDisconnectedLike);
      socket.off("connect_error", onDisconnectedLike);
      socket.off("customer:order_status_changed", onStatusChanged);
      const s = socket;
      queueMicrotask(() => {
        try {
          s.disconnect();
        } catch {
          /* ignore */
        }
      });
    };
  }, [args.enabled, args.trackingToken, pollStable]);

  useEffect(() => {
    if (!args.enabled || !args.trackingToken) return;
    if (socketConnected) return;
    const id = window.setInterval(() => void pollStable(), FALLBACK_POLL_MS);
    void pollStable();
    return () => clearInterval(id);
  }, [args.enabled, args.trackingToken, socketConnected, pollStable]);

  return {
    socketConnected,
    usingPollingFallback: !socketConnected,
  };
}
