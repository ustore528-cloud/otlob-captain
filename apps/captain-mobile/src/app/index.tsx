import { Redirect, type Href } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { useGuestStore } from "@/store/guest-store";

export default function Index() {
  const { routingReady, isAuthenticated } = useAuth();
  const isGuest = useGuestStore((s) => s.isGuest);

  if (!routingReady) {
    return null;
  }

  if (isAuthenticated) {
    return <Redirect href="/(app)/(tabs)/orders" />;
  }

  if (isGuest) {
    return <Redirect href={"/(guest)/home" as Href} />;
  }

  return <Redirect href="/(auth)/login" />;
}
