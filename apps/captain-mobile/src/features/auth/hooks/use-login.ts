import { useCallback, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { getAuthErrorMessage } from "../utils/auth-error-message";

export function useLogin() {
  const signIn = useAuthStore((s) => s.signIn);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(
    async (identifier: string, password: string) => {
      setLoading(true);
      setError(null);
      try {
        await signIn(identifier, password);
      } catch (e) {
        const msg = getAuthErrorMessage(e);
        setError(msg);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [signIn],
  );

  return { login, loading, error, setError };
}
