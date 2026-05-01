import * as SplashScreen from "expo-splash-screen";
import { useEffect, type ReactNode } from "react";
import { persistTokens } from "@/features/auth/storage/auth-storage";
import { registerTokenBridge } from "@/services/api/token-bridge";
import { connectCaptainSocket } from "@/services/socket/socket-client";
import { useAuthStore } from "@/store/auth-store";
import { useGuestStore } from "@/store/guest-store";

SplashScreen.preventAutoHideAsync();

export function AuthProvider({ children }: { children: ReactNode }) {
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const sessionReady = useAuthStore((s) => s.sessionReady);
  const guestReady = useGuestStore((s) => s.guestReady);
  const routingReady = sessionReady && guestReady;

  useEffect(() => {
    registerTokenBridge({
      getAccess: () => useAuthStore.getState().accessToken,
      getRefresh: () => useAuthStore.getState().refreshToken,
      setTokens: async (accessToken, refreshToken) => {
        await persistTokens(accessToken, refreshToken);
        useAuthStore.setState({ accessToken, refreshToken });
        connectCaptainSocket(accessToken);
      },
    });
    void (async () => {
      await bootstrap();
      const s = useAuthStore.getState();
      const authenticated = Boolean(s.accessToken && s.user && s.captain);
      await useGuestStore.getState().hydrateFromBootstrap({ authenticated });
    })();
  }, [bootstrap]);

  useEffect(() => {
    if (routingReady) {
      void SplashScreen.hideAsync();
    }
  }, [routingReady]);

  return <>{children}</>;
}
