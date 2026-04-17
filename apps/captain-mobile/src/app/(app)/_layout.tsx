import { Redirect, Stack } from "expo-router";
import { CaptainRealtimeSync } from "@/features/realtime";
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
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
