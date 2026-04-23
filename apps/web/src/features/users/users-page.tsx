import { useState } from "react";
import { Navigate } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { useToggleUserActive, useUsers } from "@/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/layout/page-header";
import { userRoleLabel } from "@/lib/user-role";
import { isDispatchRole, isManagementAdminRole } from "@/lib/rbac-roles";
import { AddUserFormCard } from "@/features/users/components/add-user-form-card";
import { UserCard } from "@/features/users/components/user-card";
import { USER_ROLE_FILTER_OPTIONS } from "@/features/users/constants";
import { useAuthStore } from "@/stores/auth-store";

export function UsersPageView() {
  const me = useAuthStore((s) => s.user);
  const [role, setRole] = useState<string>("");

  const users = useUsers({ page: 1, pageSize: 80, role });
  const toggle = useToggleUserActive();
  const togglePendingUserId = toggle.isPending ? toggle.variables?.id ?? null : null;

  const isAdmin = isManagementAdminRole(me?.role);
  const canEditCustomerProfile = isDispatchRole(me?.role);

  if (!isDispatchRole(me?.role)) return <Navigate to="/" replace />;

  return (
    <div className="grid gap-8">
      <PageHeader
        title="المستخدمون"
        description="حسابات الدخول للمنصة (مدير، مشغّل، كابتن، متجر، عميل تطبيق، …). لحساب «عميل» يمكن حفظ عناوين وروابط وأسعار تفضيلية كمرجع؛ الطلبات تُنشأ من «طلب جديد» مع بيانات الطلب."
        actions={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void users.refetch()}
            disabled={users.isFetching}
          >
            <RefreshCw className={`me-2 size-4 ${users.isFetching ? "animate-spin" : ""}`} />
            تحديث القائمة
          </Button>
        }
      />

      {isAdmin ? <AddUserFormCard /> : null}

      <Card className="border-card-border shadow-sm">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="text-base">تصفية حسب الدور</CardTitle>
            <CardDescription>
              صفِّ حسب الدور. حساب «عميل» يعرض قسم بيانات توصيل اختيارية (مثل حقول طلب جديد) للمرجع عند الحاجة.
            </CardDescription>
          </div>
          <div className="grid gap-1">
            <Label className="text-xs text-muted">الدور</Label>
            <select
              className="h-10 min-w-[200px] rounded-lg border border-card-border bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {USER_ROLE_FILTER_OPTIONS.map((r) => (
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
              <UserCard
                key={u.id}
                user={u}
                canToggleActive={isAdmin}
                canEditCustomerProfile={canEditCustomerProfile}
                togglePending={togglePendingUserId === u.id}
                onToggleActive={(id, next) => toggle.mutate({ id, isActive: next })}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
