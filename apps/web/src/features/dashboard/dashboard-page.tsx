import { Suspense, lazy, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bell, Copy, Link2, Radio, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { QueryErrorLine } from "@/features/dashboard/components/query-error-line";
import { useActivityList, useDashboardStats, useNotifications, useSendQuickStatusAlert, type QuickStatusCode } from "@/hooks";
import { canListOrdersRole, isCompanyAdminRole, isDispatchRole, isSuperAdminRole } from "@/lib/rbac-roles";
import { userRoleLabel } from "@/lib/user-role";
import { useAuthStore } from "@/stores/auth-store";
import { getLocalizedText } from "@/i18n/localize-dynamic-text";

const DashboardMapSettingsCardLazy = lazy(() =>
  import("./components/dashboard-map-settings-card").then((m) => ({ default: m.DashboardMapSettingsCard })),
);
const DashboardNotificationCardLazy = lazy(() =>
  import("./components/dashboard-notification-card").then((m) => ({ default: m.DashboardNotificationCard })),
);
const DashboardActivityCardLazy = lazy(() =>
  import("./components/dashboard-activity-card").then((m) => ({ default: m.DashboardActivityCard })),
);
const DashboardPublicRequestSettingsLazy = lazy(() =>
  import("./components/dashboard-public-request-settings-card").then((m) => ({ default: m.DashboardPublicRequestSettingsCard })),
);
const SuperAdminPublicCarouselCardLazy = lazy(() =>
  import("./components/super-admin-public-carousel-card").then((m) => ({ default: m.SuperAdminPublicCarouselCard })),
);

function useDispatchRole() {
  const r = useAuthStore((s) => s.user?.role);
  return isDispatchRole(r);
}

/**
 * Main operations dashboard — same layout; data from React Query.
 */
export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? i18n.language;
  const user = useAuthStore((s) => s.user);
  const dispatch = useDispatchRole();
  const canListOrders = canListOrdersRole(user?.role);

  const dashboard = useDashboardStats();
  const notifications = useNotifications(1, 1);
  const activity = useActivityList(1, 8, { enabled: dispatch });
  const quickStatus = useSendQuickStatusAlert();
  const [showDeferredSections, setShowDeferredSections] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setShowDeferredSections(true), 120);
    return () => window.clearTimeout(id);
  }, []);

  const stats = dashboard.data;
  const latest = notifications.data?.items?.[0];

  const quickStatusButtons: Array<{ code: QuickStatusCode; label: string }> = [
    { code: "PRESSURE", label: t("dashboard.quickStatus.PRESSURE") },
    { code: "LOW_ACTIVITY", label: t("dashboard.quickStatus.LOW_ACTIVITY") },
    { code: "RAISE_READINESS", label: t("dashboard.quickStatus.RAISE_READINESS") },
    { code: "ON_FIRE", label: t("dashboard.quickStatus.ON_FIRE") },
  ];

  return (
    <div className="grid gap-8">
      <PageHeader
        title={
          user?.fullName
            ? t("dashboard.page.welcomeWithName", {
                name: getLocalizedText(user.fullName, { lang, mode: "generic" }),
              })
            : t("dashboard.page.welcome")
        }
        description={t("dashboard.page.description")}
        actions={
          <Button type="button" variant="secondary" onClick={() => void dashboard.refetch()}>
            <Radio className="size-4 opacity-80" />
            {t("common.refresh")}
          </Button>
        }
      />

      {user && isSuperAdminRole(user.role) && showDeferredSections ? (
        <Suspense fallback={<SectionSkeleton />}>
          <SuperAdminPublicCarouselCardLazy />
        </Suspense>
      ) : null}

      {user && isCompanyAdminRole(user.role) && user.publicOwnerCode ? (
        <Suspense fallback={<SectionSkeleton />}>
          <DashboardPublicRequestSettingsLazy />
        </Suspense>
      ) : null}

      {user && isCompanyAdminRole(user.role) && user.publicOwnerCode ? (
        <Card className="border-primary/25 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("dashboard.page.requestLinkTitle")}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {t("dashboard.page.ownerCode")}: <span className="font-mono font-medium text-foreground">{user.publicOwnerCode}</span>
            </p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="default"
              onClick={() => {
                const url = `${window.location.origin}/request/${encodeURIComponent(user.publicOwnerCode!)}`;
                void navigator.clipboard.writeText(url);
              }}
            >
              <Copy className="ms-1 size-4 opacity-80" />
              {t("dashboard.page.copyLink")}
            </Button>
            <Button type="button" variant="secondary" asChild>
              <a
                href={`${window.location.origin}/request/${encodeURIComponent(user.publicOwnerCode!)}`}
                target="_blank"
                rel="noreferrer"
              >
                <Link2 className="ms-1 size-4 opacity-80" />
                {t("dashboard.page.openRequestPage")}
              </a>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {dashboard.isLoading && !stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SectionSkeleton />
          <SectionSkeleton />
          <SectionSkeleton />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label={t("dashboard.stats.ordersTotal")}
            value={canListOrders ? (stats?.ordersTotal ?? t("common.none")) : t("dashboard.stats.ordersUnavailable")}
            hint={canListOrders ? undefined : t("dashboard.stats.ordersHintNoAccess")}
            icon={Truck}
          />
          {dispatch ? (
            <StatCard
              label={t("dashboard.stats.captainsActive")}
              value={stats?.captainsActiveTotal ?? t("common.none")}
              hint={t("dashboard.stats.captainsActiveHint")}
            />
          ) : (
            <StatCard
              label={t("dashboard.stats.role")}
              value={user ? userRoleLabel(user.role) : t("common.none")}
              hint={t("dashboard.stats.roleHint")}
            />
          )}
          <StatCard
            label={t("dashboard.stats.lastAlert")}
            value={
              latest ? (latest.isRead ? t("dashboard.stats.read") : t("dashboard.stats.newBadge")) : t("common.none")
            }
            hint={latest?.title ?? t("dashboard.stats.noNotifications")}
            icon={Bell}
          />
        </div>
      )}

      {dispatch ? (
        dashboard.isLoading && !stats ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <SectionSkeleton />
            <SectionSkeleton />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              label={t("dashboard.stats.pendingDistribution")}
              value={stats?.pendingOrders ?? t("common.none")}
            />
            <StatCard
              label={t("dashboard.stats.confirmedPreparing")}
              value={stats?.confirmedOrders ?? t("common.none")}
            />
          </div>
        )
      ) : null}

      {dispatch ? (
        <Suspense fallback={<SectionSkeleton />}>
          {showDeferredSections ? <DashboardMapSettingsCardLazy /> : <SectionSkeleton />}
        </Suspense>
      ) : null}

      {dispatch ? (
        <Card className="border-card-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard.quickWorkStatus.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {quickStatusButtons.map((s) => (
                <Button
                  key={s.code}
                  type="button"
                  variant="secondary"
                  disabled={quickStatus.isPending}
                  onClick={() => quickStatus.mutate(s.code)}
                >
                  {s.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <QueryErrorLine
        messages={[
          (dashboard.error as Error)?.message,
          (notifications.error as Error)?.message,
          (activity.error as Error)?.message,
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Suspense fallback={<SectionSkeleton />}>
          {showDeferredSections ? (
            <DashboardNotificationCardLazy loading={notifications.isLoading} latest={latest} />
          ) : (
            <SectionSkeleton />
          )}
        </Suspense>
        <Suspense fallback={<SectionSkeleton />}>
          {showDeferredSections ? (
            <DashboardActivityCardLazy dispatch={dispatch} loading={activity.isLoading} items={activity.data?.items ?? []} />
          ) : (
            <SectionSkeleton />
          )}
        </Suspense>
      </div>
    </div>
  );
}

function SectionSkeleton() {
  return <div className="h-40 animate-pulse rounded-2xl border border-card-border bg-card/60" aria-hidden="true" />;
}
