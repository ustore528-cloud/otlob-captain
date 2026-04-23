import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { DashboardSidebar } from "@/layouts/dashboard/dashboard-sidebar";
import { useDashboardSocketInvalidate } from "@/layouts/dashboard/use-dashboard-socket-invalidate";
import { canListOrdersRole, isDispatchRole } from "@/lib/rbac-roles";
import { useAuthStore } from "@/stores/auth-store";

export function DashboardLayout() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);

  const role = user?.role;
  const isDispatch = isDispatchRole(role);
  const canOrders = canListOrdersRole(role);

  const nav = {
    canNewOrder: canOrders,
    canDistribution: isDispatch,
    canIncubatorHost: isDispatch,
    canOrders,
    canCaptains: isDispatch,
    canUsers: isDispatch,
  };

  useEffect(() => {
    if (!token) {
      void navigate("/login", { replace: true });
    }
  }, [navigate, token]);

  useDashboardSocketInvalidate(token);

  if (!token) return null;

  return (
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[280px_1fr]">
      <DashboardSidebar
        userLabel={user?.fullName ?? user?.phone ?? ""}
        nav={nav}
        onLogout={() => {
          clear();
          void navigate("/login", { replace: true });
        }}
      />
      <main className="min-w-0 p-4 sm:p-6 lg:p-10">
        <Outlet />
      </main>
    </div>
  );
}
