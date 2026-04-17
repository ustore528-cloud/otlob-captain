import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomerUserDataSection } from "@/features/users/components/customer-user-data-section";
import { userRoleLabel } from "@/lib/user-role";
import type { UserListItem } from "@/types/api";

type Props = {
  user: UserListItem;
  canToggleActive: boolean;
  canEditCustomerProfile: boolean;
  togglePending: boolean;
  onToggleActive: (id: string, next: boolean) => void;
};

export function UserCard({ user: u, canToggleActive, canEditCustomerProfile, togglePending, onToggleActive }: Props) {
  return (
    <Card className="border-card-border bg-card shadow-sm">
      <CardHeader className="pb-2">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted">حساب مستخدم</p>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-snug">{u.fullName}</CardTitle>
          <Badge variant={u.isActive ? "success" : "muted"}>{u.isActive ? "نشط" : "موقوف"}</Badge>
        </div>
        <CardDescription>{userRoleLabel(u.role)}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <div>
          <span className="text-xs text-muted">هاتف الحساب (للدخول / الاتصال)</span>
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
        {canToggleActive ? (
          <Button
            type="button"
            size="sm"
            variant={u.isActive ? "secondary" : "default"}
            disabled={togglePending}
            onClick={() => onToggleActive(u.id, !u.isActive)}
          >
            {u.isActive ? "تعطيل الحساب" : "تفعيل الحساب"}
          </Button>
        ) : (
          <p className="text-xs text-muted">تعديل حالة التفعيل متاح للمدير فقط.</p>
        )}
        <CustomerUserDataSection user={u} canEdit={canEditCustomerProfile} />
      </CardContent>
    </Card>
  );
}
