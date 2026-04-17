import { useEffect } from "react";
import { useAuthStore } from "@/store/auth-store";
import { queryClient } from "@/lib/query-client";
import { getCaptainSocket } from "@/services/socket/socket-client";
import { attachCaptainRealtimeListeners } from "./captain-realtime-subscriptions";
import { useAssignmentFallbackPolling } from "./hooks/use-assignment-fallback-polling";

/**
 * مستمعات Socket.IO + احتياطي الاستطلاع — يُضاف بعد تسجيل الدخول.
 */
export function CaptainRealtimeSync() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const captain = useAuthStore((s) => s.captain);
  const isOn = Boolean(accessToken && captain);

  useAssignmentFallbackPolling(isOn);

  useEffect(() => {
    if (!isOn) return;

    let detach: (() => void) | undefined;
    let poll: ReturnType<typeof setInterval> | undefined;

    const tryAttach = (): boolean => {
      const s = getCaptainSocket();
      if (!s) return false;
      detach?.();
      detach = attachCaptainRealtimeListeners(s, queryClient);
      return true;
    };

    if (!tryAttach()) {
      poll = setInterval(() => {
        if (tryAttach() && poll) {
          clearInterval(poll);
          poll = undefined;
        }
      }, 350);
    }

    return () => {
      if (poll) clearInterval(poll);
      detach?.();
    };
  }, [isOn, accessToken]);

  return null;
}
