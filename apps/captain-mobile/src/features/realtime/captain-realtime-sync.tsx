import { useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";
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
          const p = event.payload as { orderNumber?: string; timeoutSeconds?: number } | null;
          const digits = p?.orderNumber?.replace(/\D+/g, "") ?? "";
          const serial = digits ? digits.slice(-2).padStart(2, "0") : "";
          showBanner({
            kind: "order",
            title: "طلب جديد وصل",
            message: serial ? `طلب رقم ${serial} بانتظار قبولك` : "لديك طلب جديد بانتظار القبول",
          });
          return;
        }
        if (event.type === "order_updated") {
          showBanner({
            kind: "info",
            title: "تحديث على الطلب",
            message: "تم تحديث حالة أحد الطلبات لديك",
          });
          return;
        }
        showBanner({
          kind: "alert",
          title: "انتهى التعيين الحالي",
          message: "يمكنك انتظار عرض جديد أو تحديث القائمة",
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
