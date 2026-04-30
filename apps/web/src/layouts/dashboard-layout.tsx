import { useEffect } from "react";
import { Navigate, Outlet, useNavigate } from "react-router-dom";
import { DashboardSidebar } from "@/layouts/dashboard/dashboard-sidebar";
import { useDashboardSocketInvalidate } from "@/layouts/dashboard/use-dashboard-socket-invalidate";
import {
  canAccessCaptainsPage,
  canAccessComplaintsPage,
  canAccessFinancePage,
  canAccessIncubatorHost,
  canAccessReportsPage,
  canAccessUsersPage,
  canListOrdersRole,
  isAdminPanelRole,
  isDispatchRole,
} from "@/lib/rbac-roles";
import { useAuthStore } from "@/stores/auth-store";
import { useTranslation } from "react-i18next";
import { getLocalizedText } from "@/i18n/localize-dynamic-text";

export function DashboardLayout() {
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? i18n.language;
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);

  const role = user?.role;
  const isAdminPanel = isAdminPanelRole(role);
  const isDispatch = isDispatchRole(role);
  const canStoresNav = isDispatch;
  const canOrders = canListOrdersRole(role);
  const canFinance = canAccessFinancePage(role);
  const canReports = canAccessReportsPage(role);
  const canUsers = canAccessUsersPage(role);
  const canIncubator = canAccessIncubatorHost(role);
  const canCaptains = canAccessCaptainsPage(role);

  const nav = {
    canNewOrder: canOrders,
    canDistribution: isDispatch,
    canIncubatorHost: canIncubator,
    canOrders,
    canCaptains,
    canStores: canStoresNav,
    canUsers,
    canFinance,
    canReports,
    canComplaints: canAccessComplaintsPage(role),
  };

  useEffect(() => {
    if (!token) {
      void navigate("/login", { replace: true });
    }
  }, [navigate, token]);

  useDashboardSocketInvalidate(token);

  if (!token) return null;
  if (!isAdminPanel) return <Navigate to="/forbidden" replace />;

  const userLabel =
    user?.fullName != null && String(user.fullName).trim() !== ""
      ? getLocalizedText(user.fullName, { lang, mode: "generic" })
      : user?.phone ?? "";

  return (
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[280px_1fr]">
      <DashboardSidebar
        userLabel={userLabel}
        nav={nav}
        onLogout={() => {
          clear();
          void navigate("/login", { replace: true });
        }}
      />
      <main className="min-w-0 p-4 sm:p-6 lg:p-8 xl:p-10">
        <div className="mx-auto w-full max-w-[1600px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
