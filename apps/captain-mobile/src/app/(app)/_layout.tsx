import { Redirect, Stack } from "expo-router";
import { View } from "react-native";
import { CaptainRealtimeSync, InAppTopBanner } from "@/features/realtime";
import { CaptainPushSync } from "@/features/notifications/push/captain-push-sync";
import { CaptainTrackingProvider } from "@/features/tracking";
import { homeTheme } from "@/features/home/theme";
import { useAuth } from "@/hooks/use-auth";

export default function AppLayout() {
  const { sessionReady, isAuthenticated } = useAuth();

  if (!sessionReady) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
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
