import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import "@/i18n/i18n";
import { setUnauthorizedHandler } from "@/lib/api/http";
import { AppProviders } from "@/providers/app-providers";
import { router } from "@/router";
import { useAuthStore } from "@/stores/auth-store";
import "./index.css";

setUnauthorizedHandler(() => {
  useAuthStore.getState().clear();
  if (window.location.pathname !== "/login") {
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
