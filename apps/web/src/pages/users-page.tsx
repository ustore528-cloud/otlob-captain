import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useToggleUserActive, useUsers } from "@/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/layout/page-header";
import { userRoleLabel } from "@/lib/user-role";
import { useAuthStore } from "@/stores/auth-store";

const ROLES = ["", "ADMIN", "DISPATCHER", "CAPTAIN", "STORE", "CUSTOMER"] as const;

export function UsersPage() {
  const me = useAuthStore((s) => s.user);
  const [role, setRole] = useState<string>("");

  const users = useUsers({ page: 1, pageSize: 80, role });
  const toggle = useToggleUserActive();

  const isAdmin = me?.role === "ADMIN";

  if (me?.role !== "ADMIN" && me?.role !== "DISPATCHER") return <Navigate to="/" replace />;

  return (
    <div className="grid gap-8">
      <PageHeader title="المستخدمون" description="عرض حسب الدور، مع بيانات الاتصال وحالة الحساب." />

      <Card className="border-card-border shadow-sm">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="text-base">تصفية الدور</CardTitle>
            <CardDescription>يقتصر على صلاحية الإدارة والتشغيل لعرض القائمة</CardDescription>
          </div>
          <div className="grid gap-1">
            <Label className="text-xs text-muted">الدور</Label>
            <select
              className="h-10 min-w-[200px] rounded-lg border border-card-border bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {ROLES.map((r) => (
                <option key={r || "all"} value={r}>
                  {r ? userRoleLabel(r) : "الكل"}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {users.isLoading ? (
            <p className="text-sm text-muted">جارٍ التحميل…</p>
          ) : users.isError ? (
            <p className="text-sm text-red-600">{(users.error as Error).message}</p>
          ) : (
            (users.data?.items ?? []).map((u) => (
              <Card key={u.id} className="border-card-border bg-card shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-snug">{u.fullName}</CardTitle>
                    <Badge variant={u.isActive ? "success" : "muted"}>{u.isActive ? "نشط" : "موقوف"}</Badge>
                  </div>
                  <CardDescription>{userRoleLabel(u.role)}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm">
                  <div>
                    <span className="text-xs text-muted">الهاتف</span>
                    <div className="mt-0.5 font-mono text-base font-medium tracking-tight" dir="ltr">
                      {u.phone}
                    </div>
                  </div>
                  {u.email ? (
                    <div>
                      <span className="text-xs text-muted">البريد</span>
                      <div className="mt-0.5 break-all text-xs" dir="ltr">
                        {u.email}
                      </div>
                    </div>
                  ) : null}
                  {isAdmin ? (
                    <Button
                      type="button"
                      size="sm"
                      variant={u.isActive ? "secondary" : "default"}
                      disabled={toggle.isPending}
                      onClick={() => toggle.mutate({ id: u.id, isActive: !u.isActive })}
                    >
                      {u.isActive ? "تعطيل الحساب" : "تفعيل الحساب"}
                    </Button>
                  ) : (
                    <p className="text-xs text-muted">تعديل حالة التفعيل متاح للمدير فقط.</p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
