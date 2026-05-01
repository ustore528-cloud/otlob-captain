import { Redirect, Stack, type Href } from "expo-router";
import { homeTheme } from "@/features/home/theme";
import { useAuth } from "@/hooks/use-auth";
import { useGuestStore } from "@/store/guest-store";

export default function GuestLayout() {
  const { routingReady, isAuthenticated } = useAuth();
  const isGuest = useGuestStore((s) => s.isGuest);

  if (!routingReady) {
    return null;
  }

  if (isAuthenticated) {
    return <Redirect href="/(app)/(tabs)/orders" />;
  }

  if (!isGuest) {
    return <Redirect href={"/(auth)/login" as Href} />;
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
