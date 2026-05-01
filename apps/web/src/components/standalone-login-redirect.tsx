import type { ReactElement } from "react";
import { Navigate, useLocation } from "react-router-dom";
import {
  allowStaffStandaloneLoginBypass,
  isStandaloneDisplayMode,
} from "@/lib/customer-surface";

/**
 * Launcher-style browsers should not expose the staff login chrome.
 * Escape hatch: append <code>?staff=1</code> to `/login`.
 */
export function StandaloneCustomerLoginRedirect({ children }: { children: ReactElement }) {
  const { search } = useLocation();
  if (isStandaloneDisplayMode() && !allowStaffStandaloneLoginBypass(search)) {
    return <Navigate to="/customer-order" replace />;
  }
  return children;
}
