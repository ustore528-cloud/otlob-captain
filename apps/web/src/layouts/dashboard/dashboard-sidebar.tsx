import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Heart,
  LayoutDashboard,
  LogOut,
  MapPinned,
  MessageSquare,
  PlusCircle,
  Store,
  Truck,
  Users as UsersIcon,
  UsersRound,
  Wallet,
  FileBarChart2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";
import brandWordmark from "@/assets/brand-2in.png";

const navClass = ({ isActive }: { isActive: boolean }) =>
  [
    "flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition whitespace-nowrap",
    isActive
      ? "bg-primary/12 text-primary shadow-sm ring-1 ring-primary/15"
      : "text-muted hover:bg-accent/80 hover:text-foreground",
  ].join(" ");

export type DashboardNavFlags = {
  canNewOrder: boolean;
  canDistribution: boolean;
  canIncubatorHost: boolean;
  canOrders: boolean;
  canCaptains: boolean;
  canStores: boolean;
  canUsers: boolean;
  canFinance: boolean;
  canReports: boolean;
  canComplaints: boolean;
};

type Props = {
  userLabel: string;
  nav: DashboardNavFlags;
  onLogout: () => void;
};

export function DashboardSidebar({ userLabel, nav, onLogout }: Props) {
  const { t } = useTranslation();

  return (
    <aside className="border-b border-card-border bg-card/95 backdrop-blur-sm lg:sticky lg:top-0 lg:max-h-dvh lg:border-b-0 lg:border-e lg:overflow-y-auto">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-card-border/80 p-4 sm:p-5">
        <div className="min-w-0 flex-1">
          <img src={brandWordmark} alt="2in" className="mb-1 h-7 w-auto object-contain" />
          <div className="text-sm font-semibold tracking-tight text-foreground">{t("common.brand")}</div>
          <div className="truncate text-xs text-muted">{userLabel}</div>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <LanguageSwitcher className="sm:min-w-0" />
          <Button variant="ghost" size="icon" type="button" aria-label={t("common.logout")} onClick={onLogout}>
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 py-3 lg:flex-col lg:overflow-visible lg:px-2">
        <NavLink className={navClass} to="/" end>
          <LayoutDashboard className="size-4 shrink-0" />
          {t("nav.home")}
        </NavLink>
        {nav.canNewOrder ? (
          <NavLink className={navClass} to="/orders/new">
            <PlusCircle className="size-4 shrink-0" />
            {t("nav.newOrder")}
          </NavLink>
        ) : null}
        {nav.canDistribution ? (
          <NavLink className={navClass} to="/distribution">
            <MapPinned className="size-4 shrink-0" />
            {t("nav.distribution")}
          </NavLink>
        ) : null}
        {nav.canIncubatorHost ? (
          <NavLink className={navClass} to="/incubator-host">
            <Heart className="size-4 shrink-0" />
            {t("nav.incubator")}
          </NavLink>
        ) : null}
        {nav.canOrders ? (
          <NavLink className={navClass} to="/orders">
            <Truck className="size-4 shrink-0" />
            {t("nav.orders")}
          </NavLink>
        ) : null}
        {nav.canCaptains ? (
          <NavLink className={navClass} to="/captains">
            <UsersRound className="size-4 shrink-0" />
            {t("nav.captains")}
          </NavLink>
        ) : null}
        {nav.canStores ? (
          <NavLink className={navClass} to="/stores">
            <Store className="size-4 shrink-0" />
            {t("nav.stores")}
          </NavLink>
        ) : null}
        {nav.canUsers ? (
          <NavLink className={navClass} to="/users">
            <UsersIcon className="size-4 shrink-0" />
            {t("nav.users")}
          </NavLink>
        ) : null}
        {nav.canFinance ? (
          <NavLink className={navClass} to="/finance">
            <Wallet className="size-4 shrink-0" />
            {t("nav.finance")}
          </NavLink>
        ) : null}
        {nav.canReports ? (
          <NavLink className={navClass} to="/reports">
            <FileBarChart2 className="size-4 shrink-0" />
            {t("nav.reports")}
          </NavLink>
        ) : null}
        {nav.canComplaints ? (
          <NavLink className={navClass} to="/complaints">
            <MessageSquare className="size-4 shrink-0" />
            {t("nav.complaints")}
          </NavLink>
        ) : null}
      </nav>
      <div className="hidden px-5 pb-6 text-xs leading-5 text-muted lg:block">{t("dashboard.footerNote")}</div>
    </aside>
  );
}
