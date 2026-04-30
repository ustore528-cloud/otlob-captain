import { useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";
import i18n from "@/i18n/i18n";
import { useAuthStore } from "@/store/auth-store";
import { queryClient } from "@/lib/query-client";
import { logCaptainAssignment } from "@/lib/captain-assignment-debug";
import { queryKeys } from "@/hooks/api/query-keys";
import { getCaptainSocket } from "@/services/socket/socket-client";
import { attachCaptainRealtimeListeners } from "./captain-realtime-subscriptions";
import { useAssignmentFallbackPolling } from "./hooks/use-assignment-fallback-polling";
import { useInAppTopBannerStore } from "@/store/in-app-top-banner-store";

/**
 * مستمعات Socket.IO + احتياطي الاستطلاع — يُضاف بعد تسجيل الدخول.
 */
export function CaptainRealtimeSync() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const captain = useAuthStore((s) => s.captain);
  const isOn = Boolean(accessToken && captain);
  const showBanner = useInAppTopBannerStore((s) => s.showBanner);

  useAssignmentFallbackPolling(isOn);

  /** عند العودة للتطبيق من الخلفية — جلب التعيين فورًا */
  useEffect(() => {
    if (!isOn) return;
    let last: AppStateStatus = AppState.currentState;
    const sub = AppState.addEventListener("change", (next) => {
      const wasBg = last === "background" || last === "inactive";
      if (wasBg && next === "active") {
        logCaptainAssignment("APP_FOREGROUND_INVALIDATE");
        void queryClient.invalidateQueries({ queryKey: queryKeys.captain.assignment });
        void queryClient.invalidateQueries({ queryKey: ["captain-mobile", "orders", "historyInfinite"] });
      }
      last = next;
    });
    return () => sub.remove();
  }, [isOn]);

  useEffect(() => {
    if (!isOn) return;

    let detach: (() => void) | undefined;
    let poll: ReturnType<typeof setInterval> | undefined;

    const tryAttach = (): boolean => {
      const s = getCaptainSocket();
      if (!s) return false;
      detach?.();
      detach = attachCaptainRealtimeListeners(s, queryClient, (event) => {
        if (event.type === "assignment") {
          const p = event.payload as { orderNumber?: string; displayOrderNo?: number; timeoutSeconds?: number } | null;
          const displayNo = typeof p?.displayOrderNo === "number" ? p.displayOrderNo : null;
          showBanner({
            kind: "order",
            title: i18n.t("realtime.newOrderTitle"),
            message:
              displayNo != null
                ? i18n.t("realtime.newOrderMessage", { serial: displayNo })
                : i18n.t("realtime.newOrderMessageFallback"),
          });
          return;
        }
        if (event.type === "order_updated") {
          showBanner({
            kind: "info",
            title: i18n.t("realtime.orderUpdatedTitle"),
            message: i18n.t("realtime.orderUpdatedMessage"),
          });
          return;
        }
        showBanner({
          kind: "alert",
          title: i18n.t("realtime.assignmentEndedTitle"),
          message: i18n.t("realtime.assignmentEndedMessage"),
        });
      });
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
  }, [isOn, accessToken, showBanner]);

  return null;
}
