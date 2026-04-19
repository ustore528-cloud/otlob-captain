import { Redirect } from "expo-router";
import { useAuth } from "@/hooks/use-auth";

export default function Index() {
  const { sessionReady, isAuthenticated } = useAuth();

  if (!sessionReady) {
    return null;
  }

  if (isAuthenticated) {
    return <Redirect href="/(app)/(tabs)/orders" />;
  }

  return <Redirect href="/(auth)/login" />;
}
