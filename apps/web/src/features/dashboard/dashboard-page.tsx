import { Suspense, lazy, useEffect, useState } from "react";
import { Bell, Radio, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { QueryErrorLine } from "@/features/dashboard/components/query-error-line";
import { useActivityList, useDashboardStats, useNotifications, useSendQuickStatusAlert, type QuickStatusCode } from "@/hooks";
import { canListOrdersRole, isDispatchRole } from "@/lib/rbac-roles";
import { useAuthStore } from "@/stores/auth-store";

const DashboardMapSettingsCardLazy = lazy(() =>
  import("./components/dashboard-map-settings-card").then((m) => ({ default: m.DashboardMapSettingsCard })),
);
const DashboardNotificationCardLazy = lazy(() =>
  import("./components/dashboard-notification-card").then((m) => ({ default: m.DashboardNotificationCard })),
);
const DashboardActivityCardLazy = lazy(() =>
  import("./components/dashboard-activity-card").then((m) => ({ default: m.DashboardActivityCard })),
);

function useDispatchRole() {
  const r = useAuthStore((s) => s.user?.role);
  return isDispatchRole(r);
}

/**
 * لوحة التشغيل الرئيسية — نفس التخطيط والألوان؛ البيانات من React Query (قابلة للاستبدال بمصدر آخر عبر نفس أنواع العقود).
 */
export function DashboardPage() {
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
    { code: "PRESSURE", label: "ضغط" },
    { code: "LOW_ACTIVITY", label: "حركة ضعيفة" },
    { code: "RAISE_READINESS", label: "ارفع الجاهزية" },
    { code: "ON_FIRE", label: "الوضع نار" },
  ];

  return (
    <div className="grid gap-8">
      <PageHeader
        title={`مرحبًا${user?.fullName ? `، ${user.fullName}` : ""}`}
        description="نظرة تشغيلية سريعة على الطلبات والتنبيهات."
        actions={
          <Button type="button" variant="secondary" onClick={() => void dashboard.refetch()}>
            <Radio className="size-4 opacity-80" />
            تحديث
          </Button>
        }
      />

      {dashboard.isLoading && !stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SectionSkeleton />
          <SectionSkeleton />
          <SectionSkeleton />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="إجمالي الطلبات (نطاقك)"
            value={canListOrders ? (stats?.ordersTotal ?? "—") : "—"}
            hint={canListOrders ? undefined : "غير متاح لدورك"}
            icon={Truck}
          />
          {dispatch ? (
            <StatCard label="كباتن نشطون" value={stats?.captainsActiveTotal ?? "—"} hint="حسب صلاحية الإدارة" />
          ) : (
            <StatCard label="الصلاحية" value={user?.role ?? "—"} hint="عرض الطلبات حسب دورك" />
          )}
          <StatCard
            label="آخر تنبيه"
            value={latest ? (latest.isRead ? "مقروء" : "جديد") : "—"}
            hint={latest?.title ?? "لا توجد إشعارات"}
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
            <StatCard label="بانتظار التوزيع" value={stats?.pendingOrders ?? "—"} />
            <StatCard label="طلبات التجهيز" value={stats?.confirmedOrders ?? "—"} />
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
            <CardTitle className="text-base">تنبيه سريع عن حالة الشغل</CardTitle>
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
