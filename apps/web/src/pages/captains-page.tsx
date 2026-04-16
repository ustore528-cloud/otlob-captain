import { type FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { BarChart3, UserPlus } from "lucide-react";
import { useCaptainStats, useCaptains, useCreateCaptain, useToggleCaptain } from "@/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/layout/page-header";
import { useAuthStore } from "@/stores/auth-store";
import type { CaptainListItem } from "@/types/api";

function availabilityAr(s: string) {
  const m: Record<string, string> = {
    OFFLINE: "غير متصل",
    AVAILABLE: "متاح",
    BUSY: "مشغول",
    ON_DELIVERY: "في التوصيل",
  };
  return m[s] ?? s;
}

export function CaptainsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const [reportId, setReportId] = useState<string | null>(null);

  const captains = useCaptains({ page: 1, pageSize: 100 });
  const stats = useCaptainStats(reportId);
  const create = useCreateCaptain();
  const toggle = useToggleCaptain();

  function onCreateCaptain(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    create.mutate({
      fullName: String(f.get("fullName") ?? "").trim(),
      phone: String(f.get("phone") ?? "").trim(),
      email: String(f.get("email") ?? "").trim() || undefined,
      password: String(f.get("password") ?? ""),
      vehicleType: String(f.get("vehicleType") ?? "").trim(),
      area: String(f.get("area") ?? "").trim(),
    });
    e.currentTarget.reset();
  }

  if (role !== "ADMIN" && role !== "DISPATCHER") return <Navigate to="/" replace />;

  return (
    <div className="grid gap-8">
      <PageHeader title="الكباتن" description="إدارة الحسابات، التفعيل، وعرض تقارير الأداء." />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="border-card-border shadow-sm">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <UserPlus className="size-5 text-primary" />
            <div>
              <CardTitle className="text-base">إضافة كابتن</CardTitle>
              <CardDescription>ينشئ مستخدمًا بدور كابتن وكلمة مرور أولية</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={onCreateCaptain}>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="fullName">الاسم الكامل</Label>
                <Input id="fullName" name="fullName" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">الهاتف</Label>
                <Input id="phone" name="phone" required dir="ltr" className="text-left" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">البريد (اختياري)</Label>
                <Input id="email" name="email" type="email" dir="ltr" className="text-left" />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="password">كلمة المرور الأولية</Label>
                <Input id="password" name="password" type="password" minLength={8} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="vehicleType">نوع المركبة</Label>
                <Input id="vehicleType" name="vehicleType" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="area">المنطقة</Label>
                <Input id="area" name="area" required />
              </div>
              {create.isError ? <p className="text-sm text-red-600 sm:col-span-2">{(create.error as Error).message}</p> : null}
              <div className="sm:col-span-2">
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? "جارٍ الإنشاء…" : "حفظ الكابتن"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="border-card-border bg-accent/20 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">إرشاد</CardTitle>
            <CardDescription>التفعيل يتحكم في دخول الكابتن للنظام؛ التوفر يُحدَّث من تطبيق الكابتن أو من لوحة التشغيل.</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Card className="border-card-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">القائمة</CardTitle>
          <CardDescription>{captains.data ? `${captains.data.total} كابتن` : "—"}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {captains.isLoading ? (
            <p className="text-sm text-muted">جارٍ التحميل…</p>
          ) : captains.isError ? (
            <p className="text-sm text-red-600">{(captains.error as Error).message}</p>
          ) : (
            (captains.data?.items ?? []).map((c: CaptainListItem) => (
              <div
                key={c.id}
                className="flex flex-col gap-3 rounded-xl border border-card-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{c.user.fullName}</span>
                    <Badge variant={c.isActive && c.user.isActive ? "success" : "muted"}>
                      {c.isActive && c.user.isActive ? "نشط" : "موقوف"}
                    </Badge>
                    <Badge variant="default">{availabilityAr(c.availabilityStatus)}</Badge>
                  </div>
                  <div className="mt-1 text-sm text-muted" dir="ltr">
                    {c.user.phone}
                  </div>
                  <div className="mt-2 text-xs text-muted">
                    {c.vehicleType} — {c.area}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => setReportId(c.id)}>
                    <BarChart3 className="size-4" />
                    تقرير
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={c.isActive ? "secondary" : "default"}
                    disabled={toggle.isPending}
                    onClick={() => toggle.mutate({ id: c.id, isActive: !c.isActive })}
                  >
                    {c.isActive ? "تعطيل" : "تفعيل"}
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Modal
        open={Boolean(reportId)}
        onClose={() => setReportId(null)}
        title="تقرير الكابتن"
        description="إحصائيات مختصرة من الخادم"
      >
        {stats.isLoading ? (
          <p className="text-sm text-muted">جارٍ التحميل…</p>
        ) : stats.isError ? (
          <p className="text-sm text-red-600">{(stats.error as Error).message}</p>
        ) : stats.data ? (
          <div className="grid gap-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-card-border bg-background/50 p-3">
                <div className="text-xs text-muted">طلبات مسلّمة</div>
                <div className="text-xl font-semibold tabular-nums">{stats.data.ordersDelivered}</div>
              </div>
              <div className="rounded-xl border border-card-border bg-background/50 p-3">
                <div className="text-xs text-muted">طلبات نشطة</div>
                <div className="text-xl font-semibold tabular-nums">{stats.data.activeOrders}</div>
              </div>
            </div>
            <div>
              <div className="text-xs text-muted">آخر موقع مسجّل</div>
              {stats.data.lastLocation ? (
                <pre className="mt-1 max-h-40 overflow-auto rounded-lg border border-card-border bg-background/50 p-3 font-mono text-xs leading-relaxed" dir="ltr">
                  {JSON.stringify(stats.data.lastLocation, null, 2)}
                </pre>
              ) : (
                <p className="mt-1 text-muted">لا يوجد موقع مسجّل.</p>
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
