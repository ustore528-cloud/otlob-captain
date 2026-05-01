import { Redirect, Stack, type Href } from "expo-router";
import { View } from "react-native";
import { CaptainRealtimeSync, InAppTopBanner } from "@/features/realtime";
import { GuestCaptainRouteGuard } from "@/features/guest/components/guest-captain-route-guard";
import { CaptainPushSync } from "@/features/notifications/push/captain-push-sync";
import { CaptainTrackingProvider } from "@/features/tracking";
import { homeTheme } from "@/features/home/theme";
import { useAuth } from "@/hooks/use-auth";
import { useGuestStore } from "@/store/guest-store";

export default function AppLayout() {
  const { routingReady, isAuthenticated } = useAuth();
  const isGuest = useGuestStore((s) => s.isGuest);

  if (!routingReady) {
    return null;
  }

  /** Guest deep-linked into `(app)` — keep isolation; explain and offer sign-in vs stay guest. */
  if (!isAuthenticated && isGuest) {
    return <GuestCaptainRouteGuard />;
  }

  if (!isAuthenticated) {
    return <Redirect href={"/(auth)/login" as Href} />;
  }

  return (
    <CaptainTrackingProvider>
      <CaptainRealtimeSync />
      <CaptainPushSync />
      <View style={{ flex: 1, backgroundColor: homeTheme.pageBackground }}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: homeTheme.pageBackground } }} />
        <InAppTopBanner />
      </View>
    </CaptainTrackingProvider>
  );
}
