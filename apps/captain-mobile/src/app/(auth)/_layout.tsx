import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/hooks/use-auth";

export default function AuthLayout() {
  const { sessionReady, isAuthenticated } = useAuth();

  if (!sessionReady) {
    return null;
  }

  if (isAuthenticated) {
    return <Redirect href="/(app)/(tabs)" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
