import { useAuthStore, selectIsAuthenticated } from "@/store/auth-store";

export function useAuth() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const user = useAuthStore((s) => s.user);
  const captain = useAuthStore((s) => s.captain);
  const sessionReady = useAuthStore((s) => s.sessionReady);
  const signOut = useAuthStore((s) => s.signOut);

  const isAuthenticated = useAuthStore(selectIsAuthenticated);

  return {
    accessToken,
    refreshToken,
    user,
    captain,
    sessionReady,
    isAuthenticated,
    signOut,
  };
}
