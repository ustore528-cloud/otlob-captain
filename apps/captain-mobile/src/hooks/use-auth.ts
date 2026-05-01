import { useAuthStore, selectIsAuthenticated } from "@/store/auth-store";
import { useGuestStore } from "@/store/guest-store";

export function useAuth() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const user = useAuthStore((s) => s.user);
  const captain = useAuthStore((s) => s.captain);
  const sessionReady = useAuthStore((s) => s.sessionReady);
  const signOut = useAuthStore((s) => s.signOut);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);
  const guestReady = useGuestStore((s) => s.guestReady);

  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const routingReady = sessionReady && guestReady;

  return {
    accessToken,
    refreshToken,
    user,
    captain,
    sessionReady,
    routingReady,
    isAuthenticated,
    signOut,
    deleteAccount,
  };
}
