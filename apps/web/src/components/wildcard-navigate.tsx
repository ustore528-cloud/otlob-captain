import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { isStandaloneDisplayMode } from "@/lib/customer-surface";

/** Unknown URLs: staff browsers → dashboard home; installed customer shell → safe landing without admin chrome. */
export function WildcardNavigate() {
  const token = useAuthStore((s) => s.token);
  const standalone = isStandaloneDisplayMode();
  if (standalone && !token) {
    return <Navigate to="/customer-order" replace />;
  }
  return <Navigate to="/" replace />;
}
