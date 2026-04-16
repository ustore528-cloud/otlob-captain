import { Activity, Bell, Radio, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { useActivityList, useDashboardStats, useNotifications } from "@/hooks";
import { useAuthStore } from "@/stores/auth-store";

function useDispatch() {
  const r = useAuthStore((s) => s.user?.role);
  return r === "ADMIN" || r === "DISPATCHER";
}

export function HomePage() {
  const user = useAuthStore((s) => s.user);
  const dispatch = useDispatch();
  const canListOrders = Boolean(
    user && (user.role === "ADMIN" || user.role === "DISPATCHER" || user.role === "STORE"),
  );

  const dashboard = useDashboardStats();
  const notifications = useNotifications(1, 1);
  const activity = useActivityList(1, 8, { enabled: dispatch });

  const stats = dashboard.data;
  const latest = notifications.data?.items?.[0];

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
          <StatCard
            label="كباتن نشطون"
            value={stats?.captainsActiveTotal ?? "—"}
            hint="حسب صلاحية الإدارة"
          />
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

      {(dashboard.isError || notifications.isError || activity.isError) && (
        <p className="text-sm text-red-600">
          {(dashboard.error as Error)?.message ??
            (notifications.error as Error)?.message ??
            (activity.error as Error)?.message}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-card-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">آخر تنبيه</CardTitle>
            <CardDescription>أحدث إشعار في صندوقك</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            {notifications.isLoading ? (
              <p className="text-muted">جارٍ التحميل…</p>
            ) : latest ? (
              <div className="grid gap-2 rounded-xl border border-card-border bg-background/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{latest.title}</span>
                  {!latest.isRead ? <span className="text-xs text-primary">غير مقروء</span> : null}
                </div>
                <p className="text-muted leading-relaxed">{latest.body}</p>
                <p className="text-xs text-muted" dir="ltr">
                  {new Date(latest.createdAt).toLocaleString("ar-SA")}
                </p>
              </div>
            ) : (
              <p className="text-muted">لا توجد إشعارات بعد.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-card-border shadow-sm">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <Activity className="size-5 text-primary" />
            <div>
              <CardTitle className="text-base">ملخص النشاط</CardTitle>
              <CardDescription>آخر الأحداث التشغيلية (للمشغّل/المدير)</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="text-sm">
            {!dispatch ? (
              <p className="text-muted">يتوفر ملخص النشاط لحسابات الإدارة والتشغيل.</p>
            ) : activity.isLoading ? (
              <p className="text-muted">جارٍ التحميل…</p>
            ) : (
              <ul className="grid gap-2">
                {(activity.data?.items ?? []).map((a) => (
                  <li key={a.id} className="rounded-lg border border-card-border bg-background/40 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-xs text-primary">{a.action}</span>
                      <span className="text-xs text-muted" dir="ltr">
                        {new Date(a.createdAt).toLocaleString("ar-SA")}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      {a.entityType} / <span className="font-mono">{a.entityId}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
