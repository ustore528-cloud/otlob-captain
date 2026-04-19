import { NavLink } from "react-router-dom";
import {
  Heart,
  LayoutDashboard,
  LogOut,
  MapPinned,
  PlusCircle,
  Truck,
  Users as UsersIcon,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navClass = ({ isActive }: { isActive: boolean }) =>
  [
    "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition whitespace-nowrap",
    isActive ? "bg-primary/12 text-primary" : "text-muted hover:bg-accent/80 hover:text-foreground",
  ].join(" ");

export type DashboardNavFlags = {
  canNewOrder: boolean;
  canDistribution: boolean;
  canIncubatorHost: boolean;
  canOrders: boolean;
  canCaptains: boolean;
  canUsers: boolean;
};

type Props = {
  userLabel: string;
  nav: DashboardNavFlags;
  onLogout: () => void;
};

export function DashboardSidebar({ userLabel, nav, onLogout }: Props) {
  return (
    <aside className="border-b border-card-border bg-card lg:border-b-0 lg:border-e">
      <div className="flex items-center justify-between gap-3 p-5">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground">اطلب كابتن</div>
          <div className="truncate text-xs text-muted">{userLabel}</div>
        </div>
        <Button variant="ghost" size="icon" type="button" aria-label="تسجيل الخروج" onClick={onLogout}>
          <LogOut className="size-4" />
        </Button>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible">
        <NavLink className={navClass} to="/" end>
          <LayoutDashboard className="size-4 shrink-0" />
          الرئيسية
        </NavLink>
        {nav.canNewOrder ? (
          <NavLink className={navClass} to="/orders/new">
            <PlusCircle className="size-4 shrink-0" />
            طلب جديد
          </NavLink>
        ) : null}
        {nav.canDistribution ? (
          <NavLink className={navClass} to="/distribution">
            <MapPinned className="size-4 shrink-0" />
            التوزيع
          </NavLink>
        ) : null}
        {nav.canIncubatorHost ? (
          <NavLink className={navClass} to="/incubator-host">
            <Heart className="size-4 shrink-0" />
            الأم الحاضنة
          </NavLink>
        ) : null}
        {nav.canOrders ? (
          <NavLink className={navClass} to="/orders">
            <Truck className="size-4 shrink-0" />
            الطلبات
          </NavLink>
        ) : null}
        {nav.canCaptains ? (
          <NavLink className={navClass} to="/captains">
            <UsersRound className="size-4 shrink-0" />
            الكباتن
          </NavLink>
        ) : null}
        {nav.canUsers ? (
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
  );
}
