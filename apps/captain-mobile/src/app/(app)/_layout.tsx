import { Redirect, Stack } from "expo-router";
import { View } from "react-native";
import { CaptainRealtimeSync, InAppTopBanner } from "@/features/realtime";
import { CaptainPushSync } from "@/features/notifications/push/captain-push-sync";
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
    <>
      <CaptainRealtimeSync />
      <CaptainPushSync />
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }} />
        <InAppTopBanner />
      </View>
    </>
  );
}
