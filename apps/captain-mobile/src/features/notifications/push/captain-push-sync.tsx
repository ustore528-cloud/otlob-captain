import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef } from "react";
import { Alert, AppState, Linking, Platform } from "react-native";
import i18n from "@/i18n/i18n";
import { routes } from "@/navigation/routes";
import { queryClient } from "@/lib/query-client";
import { queryKeys } from "@/hooks/api/query-keys";
import { captainService } from "@/services/api/services/captain.service";
import { useAuthStore } from "@/store/auth-store";

const ANDROID_CHANNEL_ID = "captain-orders-v2";
/** Must match system UI / release checklist (Settings → Notifications → channel name). */
const ANDROID_CHANNEL_NAME = "Captain Orders";
const ORDER_NOTIFICATION_SOUND = "new_order.wav";
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
      // Suppress default foreground alert for remote order push; we re-post via captain-orders-v2 local notification.
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
  // Before any push token work or inbound handling: create high-priority channel (FCM maps by channelId).
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: ANDROID_CHANNEL_NAME,
    importance: Notifications.AndroidImportance.MAX,
    sound: ORDER_NOTIFICATION_SOUND,
    vibrationPattern: [0, 280, 120, 280],
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
  try {
    const ch = await Notifications.getNotificationChannelAsync(ANDROID_CHANNEL_ID);
    // eslint-disable-next-line no-console
    console.info("[captain-push-sync] getNotificationChannelAsync(captain-orders-v2)", {
      snapshot: ch
        ? {
            id: ch.id,
            name: ch.name,
            importance: ch.importance,
            sound: ch.sound,
            vibrationPattern: ch.vibrationPattern,
            enableVibrate: ch.enableVibrate,
            lockscreenVisibility: ch.lockscreenVisibility,
            bypassDnd: ch.bypassDnd,
            audioAttributes: ch.audioAttributes,
          }
        : null,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[captain-push-sync] getNotificationChannelAsync failed", {
      error: e instanceof Error ? e.message : String(e),
    });
  }
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
      title: content.title ?? i18n.t("push.foregroundTitleDefault"),
      body: content.body ?? i18n.t("push.foregroundBodyDefault"),
      data: {
        ...data,
        [FOREGROUND_LOCAL_ECHO]: true,
      },
      sound: ORDER_NOTIFICATION_SOUND,
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
  const permissionDeniedAlertShownRef = useRef(false);
  const projectId = useMemo(resolveProjectId, []);

  useEffect(() => {
    if (!isAuthed) {
      submittedTokenRef.current = null;
      permissionDeniedAlertShownRef.current = false;
      return;
    }
    let cancelled = false;

    const syncPushToken = async (reason: string) => {
      if (syncInFlightRef.current) return;
      syncInFlightRef.current = true;
      try {
        // eslint-disable-next-line no-console
        console.info("[captain-push-sync] syncPushToken started", {
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
      console.info("[captain-push-sync] notification permission status", {
        reason,
        phase: "initial",
        platform: Platform.OS,
        status: perms.status,
        canAskAgain: perms.canAskAgain,
        granted: perms.granted,
        iosStatus: perms.ios?.status,
      });
      if (status !== "granted") {
        const asked = await requestNotificationPermissions();
        status = asked.status;
        // eslint-disable-next-line no-console
        console.info("[captain-push-sync] notification permission status", {
          reason,
          phase: "after_request",
          platform: Platform.OS,
          status: asked.status,
          canAskAgain: asked.canAskAgain,
          granted: asked.granted,
          iosStatus: asked.ios?.status,
        });
      }
      if (status !== "granted") {
        // eslint-disable-next-line no-console
        console.warn("[captain-push-sync] notification_permission_not_granted", { status, reason });
        if (!permissionDeniedAlertShownRef.current) {
          permissionDeniedAlertShownRef.current = true;
          Alert.alert(
            i18n.t("push.permissionDeniedTitle"),
            i18n.t("push.permissionDeniedBody"),
            [
              { text: i18n.t("push.permissionDeniedDismiss"), style: "cancel" },
              {
                text: i18n.t("push.permissionOpenSettings"),
                onPress: () => {
                  void Linking.openSettings();
                },
              },
            ],
          );
        }
        return;
      }
      permissionDeniedAlertShownRef.current = false;

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
      console.info(`[captain-push-sync] expo push token created: ${maskPushToken(expoToken)}`);
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
        requestUrl: `${process.env.EXPO_PUBLIC_API_URL ?? "NO_ENV_API_URL"}${"/api/v1/mobile/captain/me/push-token"}`,
        authTokenExists: Boolean(accessToken),
        payload: {
          ...requestPayload,
          token: maskPushToken(requestPayload.token),
        },
      });
      const result = await captainService.registerPushTokenWithMeta({
        token: requestPayload.token,
        platform: requestPayload.platform,
        appVersion: requestPayload.appVersion,
      });
      // eslint-disable-next-line no-console
      console.info("[captain-push-sync] register_push_token_response", {
        reason,
        url: result.url,
        status: result.status,
        responseBody: result.responseBody,
        responseData: result.data,
      });
      if (!result.data.registered) {
        // eslint-disable-next-line no-console
        console.warn("[captain-push-sync] server_rejected_expo_push_token", { reason });
        return;
      }
      submittedTokenRef.current = expoToken;
      // eslint-disable-next-line no-console
      console.info("[captain-push-sync] push token registered to backend successfully");
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
          if (result.registered) {
            submittedTokenRef.current = next;
            // eslint-disable-next-line no-console
            console.info("[captain-push-sync] push token registered to backend successfully");
          }
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
