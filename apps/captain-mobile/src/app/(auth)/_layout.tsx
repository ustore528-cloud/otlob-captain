import { Redirect, Stack } from "expo-router";
import { homeTheme } from "@/features/home/theme";
import { useAuth } from "@/hooks/use-auth";

export default function AuthLayout() {
  const { sessionReady, isAuthenticated } = useAuth();

  if (!sessionReady) {
    return null;
  }

  if (isAuthenticated) {
    return <Redirect href="/(app)/(tabs)/orders" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: homeTheme.pageBackground },
      }}
    />
  );
}
