import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  LogOut,
  MapPinned,
  PlusCircle,
  Truck,
  Users as UsersIcon,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { queryKeys } from "@/lib/api/query-keys";
import { createDashboardSocket } from "@/lib/socket";
import { useAuthStore } from "@/stores/auth-store";

const navClass = ({ isActive }: { isActive: boolean }) =>
  [
    "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition whitespace-nowrap",
    isActive ? "bg-primary/12 text-primary" : "text-muted hover:bg-accent/80 hover:text-foreground",
  ].join(" ");

export function DashboardLayout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);

  const role = user?.role;
  const isDispatch = role === "ADMIN" || role === "DISPATCHER";
  const canOrders = role === "ADMIN" || role === "DISPATCHER" || role === "STORE";
  const canNewOrder = canOrders;
  const canDistribution = isDispatch;
  const canCaptains = isDispatch;
  const canUsers = isDispatch;

  useEffect(() => {
    if (!token) {
      void navigate("/login", { replace: true });
    }
  }, [navigate, token]);

  useEffect(() => {
    if (!token) return;
    const socket = createDashboardSocket(token);
    const bump = () => {
      void qc.invalidateQueries({ queryKey: queryKeys.orders.root });
      void qc.invalidateQueries({ queryKey: queryKeys.captains.root });
      void qc.invalidateQueries({ queryKey: queryKeys.users.root });
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard.root });
      void qc.invalidateQueries({ queryKey: queryKeys.tracking.root });
      void qc.invalidateQueries({ queryKey: queryKeys.notifications.root });
      void qc.invalidateQueries({ queryKey: queryKeys.activity.root });
      void qc.invalidateQueries({ queryKey: queryKeys.stores.root });
    };
    socket.on("order:created", bump);
    socket.on("order:updated", bump);
    socket.on("captain:location", bump);
    return () => {
      socket.off("order:created", bump);
      socket.off("order:updated", bump);
      socket.off("captain:location", bump);
      socket.disconnect();
    };
  }, [qc, token]);

  if (!token) return null;

  return (
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[280px_1fr]">
      <aside className="border-b border-card-border bg-card lg:border-b-0 lg:border-e">
        <div className="flex items-center justify-between gap-3 p-5">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">اطلب كابتن</div>
            <div className="truncate text-xs text-muted">{user?.fullName ?? user?.phone}</div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            aria-label="تسجيل الخروج"
            onClick={() => {
              clear();
              void navigate("/login", { replace: true });
            }}
          >
            <LogOut className="size-4" />
          </Button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible">
          <NavLink className={navClass} to="/" end>
            <LayoutDashboard className="size-4 shrink-0" />
            الرئيسية
          </NavLink>
          {canNewOrder ? (
            <NavLink className={navClass} to="/orders/new">
              <PlusCircle className="size-4 shrink-0" />
              طلب جديد
            </NavLink>
          ) : null}
          {canDistribution ? (
            <NavLink className={navClass} to="/distribution">
              <MapPinned className="size-4 shrink-0" />
              التوزيع
            </NavLink>
          ) : null}
          {canOrders ? (
            <NavLink className={navClass} to="/orders">
              <Truck className="size-4 shrink-0" />
              الطلبات
            </NavLink>
          ) : null}
          {canCaptains ? (
            <NavLink className={navClass} to="/captains">
              <UsersRound className="size-4 shrink-0" />
              الكباتن
            </NavLink>
          ) : null}
          {canUsers ? (
            <NavLink className={navClass} to="/users">
              <UsersIcon className="size-4 shrink-0" />
              المستخدمون
            </NavLink>
          ) : null}
        </nav>
        <div className="hidden px-5 pb-6 text-xs leading-5 text-muted lg:block">
          عميل API موحّد مع React Query — جاهز لربط تطبيق الجوال لاحقاً عبر نفس الـ hooks أو `createApiClient`.
        </div>
      </aside>
      <main className="min-w-0 p-4 sm:p-6 lg:p-10">
        <Outlet />
      </main>
    </div>
  );
}
