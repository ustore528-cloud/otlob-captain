import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef } from "react";
import { Platform } from "react-native";
import { routes } from "@/navigation/routes";
import { captainService } from "@/services/api/services/captain.service";
import { useAuthStore } from "@/store/auth-store";

const ANDROID_CHANNEL_ID = "captain-orders";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
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
    vibrationPattern: [0, 280, 120, 280],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    enableVibrate: true,
  });
}

export function CaptainPushSync() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const captain = useAuthStore((s) => s.captain);
  const isAuthed = Boolean(accessToken && captain);
  const submittedTokenRef = useRef<string | null>(null);
  const projectId = useMemo(resolveProjectId, []);

  useEffect(() => {
    if (!isAuthed) {
      submittedTokenRef.current = null;
      return;
    }
    let cancelled = false;

    const syncPushToken = async () => {
      await ensureAndroidChannel();
      const perms = await Notifications.getPermissionsAsync();
      let status = perms.status;
      if (status !== "granted") {
        const asked = await Notifications.requestPermissionsAsync();
        status = asked.status;
      }
      if (status !== "granted") return;

      if (!projectId) return;
      const expoToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      if (cancelled || !expoToken) return;
      if (submittedTokenRef.current === expoToken) return;

      await captainService.registerPushToken({
        token: expoToken,
        platform: Platform.OS === "ios" ? "ios" : "android",
        appVersion: Constants.expoConfig?.version ?? null,
      });
      submittedTokenRef.current = expoToken;
    };

    void syncPushToken();

    const tokenSub = Notifications.addPushTokenListener((token) => {
      if (cancelled) return;
      const next = token.data;
      if (!next || submittedTokenRef.current === next) return;
      void captainService
        .registerPushToken({
          token: next,
          platform: Platform.OS === "ios" ? "ios" : "android",
          appVersion: Constants.expoConfig?.version ?? null,
        })
        .then(() => {
          submittedTokenRef.current = next;
        })
        .catch(() => {
          // Keep app flow safe; next refresh/login will retry.
        });
    });

    const tapSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { orderId?: string } | undefined;
      const orderId = typeof data?.orderId === "string" ? data.orderId : "";
      if (orderId) router.push(routes.app.order(orderId));
    });

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response || cancelled) return;
      const data = response.notification.request.content.data as { orderId?: string } | undefined;
      const orderId = typeof data?.orderId === "string" ? data.orderId : "";
      if (orderId) router.push(routes.app.order(orderId));
    });

    return () => {
      cancelled = true;
      tokenSub.remove();
      tapSub.remove();
    };
  }, [isAuthed, projectId, router]);

  return null;
}
