import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { matchesCustomerSurfacePath } from "@/lib/customer-surface";

/**
 * Registers customer Web Push SW only while on anonymous order surfaces —
 * avoids sharing the worker with dashboard sessions on the same origin.
 */
export function CustomerPushRegistrar() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    if (!matchesCustomerSurfacePath(pathname)) return;
    void navigator.serviceWorker.register("/customer-order-sw.js", { scope: "/" }).catch(() => undefined);
  }, [pathname]);

  return null;
}
