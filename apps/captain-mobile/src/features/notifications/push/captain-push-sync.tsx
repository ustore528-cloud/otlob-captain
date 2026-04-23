import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef } from "react";
import { AppState, Platform } from "react-native";
import { routes } from "@/navigation/routes";
import { queryClient } from "@/lib/query-client";
import { queryKeys } from "@/hooks/api/query-keys";
import { captainService } from "@/services/api/services/captain.service";
import { useAuthStore } from "@/store/auth-store";

const ANDROID_CHANNEL_ID = "captain-orders";
const FOREGROUND_LOCAL_ECHO = "captainForegroundLocalEcho";
const NOTIFICATION_VIBRATION_PATTERN = [0, 280, 120, 280] as const;

function maskPushToken(token: string): string {
  return token.length <= 24 ? `${token.slice(0, 8)}...` : `${token.slice(0, 18)}...${token.slice(-6)}`;
}

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as { orderId?: unknown; [FOREGROUND_LOCAL_ECHO]?: unknown };
    const isRemoteOrderPush = typeof data?.orderId === "string" && data[FOREGROUND_LOCAL_ECHO] !== true;

    return {
      // Foreground order pushes are re-presented as a local notification below so Android uses our channel.
      shouldShowAlert: !isRemoteOrderPush,
      shouldPlaySound: !isRemoteOrderPush,
      shouldSetBadge: false,
      priority: Notifications.AndroidNotificationPriority.MAX,
    };
  },
});

function resolveProjectId(): string | null {
  const fromEas = (Constants.easConfig as { projectId?: string } | null)?.projectId;
  if (fromEas) return fromEas;
  const fromExpoExtra = (
    Constants.expoConfig as { extra?: { eas?: { projectId?: string } } } | null
  )?.extra?.eas?.projectId;
  return fromExpoExtra ?? null;
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: "طلبات الكابتن",
    description: "تنبيهات العروض والتحديثات المهمة للطلبات",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
    vibrationPattern: [...NOTIFICATION_VIBRATION_PATTERN],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    enableVibrate: true,
  });
}

async function requestNotificationPermissions(): Promise<Notifications.NotificationPermissionsStatus> {
  return Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });
}

async function presentForegroundOrderNotification(notification: Notifications.Notification): Promise<void> {
  const content = notification.request.content;
  const data = content.data as { orderId?: unknown; kind?: unknown; [FOREGROUND_LOCAL_ECHO]?: unknown };
  if (typeof data?.orderId !== "string" || data[FOREGROUND_LOCAL_ECHO] === true) return;

  await ensureAndroidChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: content.title ?? "طلب جديد بانتظار قبولك",
      body: content.body ?? "لديك عرض طلب جديد. اضغط لفتح التفاصيل.",
      data: {
        ...data,
        [FOREGROUND_LOCAL_ECHO]: true,
      },
      sound: "default",
      vibrate: [...NOTIFICATION_VIBRATION_PATTERN],
      priority: Notifications.AndroidNotificationPriority.MAX,
    },
    trigger: Platform.OS === "android" ? { channelId: ANDROID_CHANNEL_ID } : null,
  });
}

export function CaptainPushSync() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const captain = useAuthStore((s) => s.captain);
  const isAuthed = Boolean(accessToken && captain);
  const submittedTokenRef = useRef<string | null>(null);
  const syncInFlightRef = useRef(false);
  const projectId = useMemo(resolveProjectId, []);

  useEffect(() => {
    if (!isAuthed) {
      submittedTokenRef.current = null;
      return;
    }
    let cancelled = false;

    const syncPushToken = async (reason: string) => {
      if (syncInFlightRef.current) return;
      syncInFlightRef.current = true;
      try {
      // eslint-disable-next-line no-console
      console.info("[captain-push-sync] sync_started", {
        reason,
        platform: Platform.OS,
        isAuthed,
        hasAccessToken: Boolean(accessToken),
        hasCaptain: Boolean(captain),
      });
      await ensureAndroidChannel();
      const perms = await Notifications.getPermissionsAsync();
      let status = perms.status;
      // eslint-disable-next-line no-console
      console.info("[captain-push-sync] permission_status", {
        reason,
        beforeRequest: perms.status,
        canAskAgain: perms.canAskAgain,
        granted: perms.granted,
      });
      if (status !== "granted") {
        const asked = await requestNotificationPermissions();
        status = asked.status;
        // eslint-disable-next-line no-console
        console.info("[captain-push-sync] permission_status", {
          reason,
          afterRequest: asked.status,
          canAskAgain: asked.canAskAgain,
          granted: asked.granted,
        });
      }
      if (status !== "granted") {
        // eslint-disable-next-line no-console
        console.warn("[captain-push-sync] notification_permission_not_granted", { status, reason });
        return;
      }

      // eslint-disable-next-line no-console
      console.info("[captain-push-sync] project_id", { reason, projectId });
      if (!projectId) {
        // eslint-disable-next-line no-console
        console.warn("[captain-push-sync] missing_eas_project_id", { reason });
        return;
      }
      // eslint-disable-next-line no-console
      console.info("[captain-push-sync] get_expo_push_token_started", { reason, projectId });
      const expoToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      if (cancelled || !expoToken) return;
      // eslint-disable-next-line no-console
      console.info("[captain-push-sync] expo_push_token_received", {
        reason,
        token: maskPushToken(expoToken),
      });
      if (submittedTokenRef.current === expoToken) {
        // eslint-disable-next-line no-console
        console.info("[captain-push-sync] register_push_token_skipped", {
          reason,
          token: maskPushToken(expoToken),
          cause: "already_submitted_in_session",
        });
        return;
      }

      const requestPayload = {
        token: expoToken,
        platform: Platform.OS === "ios" ? "ios" as const : "android" as const,
        appVersion: Constants.expoConfig?.version,
      };
      // eslint-disable-next-line no-console
      console.info("[captain-push-sync] register_push_token_request", {
        reason,
        payload: {
          ...requestPayload,
          token: maskPushToken(requestPayload.token),
        },
      });
      const result = await captainService.registerPushToken({
        token: requestPayload.token,
        platform: requestPayload.platform,
        appVersion: requestPayload.appVersion,
      });
      // eslint-disable-next-line no-console
      console.info("[captain-push-sync] register_push_token_response", { reason, response: result });
      if (!result.registered) {
        // eslint-disable-next-line no-console
        console.warn("[captain-push-sync] server_rejected_expo_push_token", { reason });
        return;
      }
      submittedTokenRef.current = expoToken;
      // eslint-disable-next-line no-console
      console.info("[captain-push-sync] expo_push_token_registered", { reason, platform: Platform.OS });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn("[captain-push-sync] sync_failed", {
          reason,
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        syncInFlightRef.current = false;
      }
    };

    void syncPushToken("mount");

    const retryId = setInterval(() => {
      void syncPushToken("retry");
    }, 60_000);

    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void syncPushToken("app_active");
      }
    });

    const tokenSub = Notifications.addPushTokenListener((token) => {
      if (cancelled) return;
      const next = token.data;
      if (!next || submittedTokenRef.current === next) return;
      // eslint-disable-next-line no-console
      console.info("[captain-push-sync] push_token_changed", { token: maskPushToken(next) });
      void captainService
        .registerPushToken({
          token: next,
          platform: Platform.OS === "ios" ? "ios" : "android",
          appVersion: Constants.expoConfig?.version,
        })
        .then((result) => {
          // eslint-disable-next-line no-console
          console.info("[captain-push-sync] push_token_change_register_response", { response: result });
          if (result.registered) submittedTokenRef.current = next;
        })
        .catch((error) => {
          // eslint-disable-next-line no-console
          console.warn("[captain-push-sync] push_token_change_register_failed", {
            error: error instanceof Error ? error.message : String(error),
          });
          // Keep app flow safe; next refresh/login will retry.
        });
    });

    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as { orderId?: string } | undefined;
      if (typeof data?.orderId === "string" && data.orderId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.captain.assignment });
        void queryClient.invalidateQueries({ queryKey: ["captain-mobile", "orders", "detail"] });
        void presentForegroundOrderNotification(notification).catch(() => {
          // Foreground sound is best-effort; the remote push path remains authoritative.
        });
      }
      void queryClient.invalidateQueries({ queryKey: ["captain-mobile", "notifications", "list"] });
    });

    const tapSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { orderId?: string } | undefined;
      const orderId = typeof data?.orderId === "string" ? data.orderId : "";
      if (orderId) {
        router.push(routes.app.order(orderId));
        void Notifications.clearLastNotificationResponseAsync();
      }
    });

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response || cancelled) return;
      const data = response.notification.request.content.data as { orderId?: string } | undefined;
      const orderId = typeof data?.orderId === "string" ? data.orderId : "";
      if (orderId) {
        router.push(routes.app.order(orderId));
        void Notifications.clearLastNotificationResponseAsync();
      }
    });

    return () => {
      cancelled = true;
      clearInterval(retryId);
      appStateSub.remove();
      tokenSub.remove();
      receivedSub.remove();
      tapSub.remove();
    };
  }, [isAuthed, projectId, router]);

  return null;
}
