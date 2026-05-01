import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import "@/i18n/i18n";
import { matchesCustomerSurfacePath } from "@/lib/customer-surface";
import { setUnauthorizedHandler } from "@/lib/api/http";
import { AppProviders } from "@/providers/app-providers";
import { router } from "@/router";
import { useAuthStore } from "@/stores/auth-store";
import "./index.css";

setUnauthorizedHandler(() => {
  useAuthStore.getState().clear();
  const pathname = window.location.pathname;
  /** Public customer endpoints should never bounce into the dashboard login UX */
  if (matchesCustomerSurfacePath(pathname)) {
    return;
  }
  if (pathname !== "/login") {
    window.location.replace("/login");
  }
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
