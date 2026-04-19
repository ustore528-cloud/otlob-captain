import { Bell, Radio, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { DashboardActivityCard } from "@/features/dashboard/components/dashboard-activity-card";
import { DashboardMapSettingsCard } from "@/features/dashboard/components/dashboard-map-settings-card";
import { DashboardNotificationCard } from "@/features/dashboard/components/dashboard-notification-card";
import { QueryErrorLine } from "@/features/dashboard/components/query-error-line";
import { useActivityList, useDashboardStats, useNotifications, useSendQuickStatusAlert, type QuickStatusCode } from "@/hooks";
import { useAuthStore } from "@/stores/auth-store";

function useDispatchRole() {
  const r = useAuthStore((s) => s.user?.role);
  return r === "ADMIN" || r === "DISPATCHER";
}

/**
 * لوحة التشغيل الرئيسية — نفس التخطيط والألوان؛ البيانات من React Query (قابلة للاستبدال بمصدر آخر عبر نفس أنواع العقود).
 */
export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const dispatch = useDispatchRole();
  const canListOrders = Boolean(
    user && (user.role === "ADMIN" || user.role === "DISPATCHER" || user.role === "STORE"),
  );

  const dashboard = useDashboardStats();
  const notifications = useNotifications(1, 1);
  const activity = useActivityList(1, 8, { enabled: dispatch });
  const quickStatus = useSendQuickStatusAlert();

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

      {dispatch ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard label="بانتظار التوزيع" value={stats?.pendingOrders ?? "—"} />
          <StatCard label="طلبات التجهيز" value={stats?.confirmedOrders ?? "—"} />
        </div>
      ) : null}

      {dispatch ? <DashboardMapSettingsCard /> : null}

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
        <DashboardNotificationCard loading={notifications.isLoading} latest={latest} />
        <DashboardActivityCard
          dispatch={dispatch}
          loading={activity.isLoading}
          items={activity.data?.items ?? []}
        />
      </div>
    </div>
  );
}
