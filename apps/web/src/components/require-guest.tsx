import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";

export function RequireGuest({ children }: { children: ReactElement }) {
  const token = useAuthStore((s) => s.token);
  if (token) return <Navigate to="/" replace />;
  return children;
}
