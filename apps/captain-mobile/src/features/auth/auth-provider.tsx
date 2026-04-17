import * as SplashScreen from "expo-splash-screen";
import { useEffect, type ReactNode } from "react";
import { persistTokens } from "@/features/auth/storage/auth-storage";
import { registerTokenBridge } from "@/services/api/token-bridge";
import { connectCaptainSocket } from "@/services/socket/socket-client";
import { useAuthStore } from "@/store/auth-store";

SplashScreen.preventAutoHideAsync();

export function AuthProvider({ children }: { children: ReactNode }) {
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const sessionReady = useAuthStore((s) => s.sessionReady);

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
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (sessionReady) {
      void SplashScreen.hideAsync();
    }
  }, [sessionReady]);

  return <>{children}</>;
}
