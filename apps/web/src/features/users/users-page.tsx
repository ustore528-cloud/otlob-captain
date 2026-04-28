import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useToggleUserActive, useUsers } from "@/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/layout/page-header";
import { apiFetch, paths } from "@/lib/api";
import { userRoleLabel } from "@/lib/user-role";
import { canAccessUsersPage, isManagementAdminRole, isSuperAdminRole } from "@/lib/rbac-roles";
import { AddUserFormCard } from "@/features/users/components/add-user-form-card";
import { SuperAdminCompaniesArchiveSection } from "@/features/users/components/super-admin-companies-archive-section";
import { UserCard } from "@/features/users/components/user-card";
import { USER_ROLE_FILTER_OPTIONS } from "@/features/users/constants";
import { useAuthStore } from "@/stores/auth-store";

export function UsersPageView() {
  const { t } = useTranslation();
  const token = useAuthStore((s) => s.token);
  const me = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);
  const [role, setRole] = useState<string>("");
  const meQuery = useQuery({
    queryKey: ["auth", "me", token],
    queryFn: () => apiFetch<typeof me>(paths.auth.me, { token }),
    enabled: Boolean(token),
  });
  useEffect(() => {
    if (!token || !meQuery.data) return;
    if (!me || me.role !== meQuery.data.role) {
      setSession(token, meQuery.data);
    }
  }, [token, me, meQuery.data, setSession]);
  const effectiveRole = meQuery.data?.role ?? me?.role;

  const users = useUsers({ page: 1, pageSize: 80, role });
  const toggle = useToggleUserActive();
  const togglePendingUserId = toggle.isPending ? toggle.variables?.id ?? null : null;

  const canCreateUser = isSuperAdminRole(effectiveRole);
  const canToggleUserActive = isManagementAdminRole(effectiveRole);
  const canEditCustomerProfile = canAccessUsersPage(effectiveRole);

  if (!canAccessUsersPage(effectiveRole)) return <Navigate to="/" replace />;

  return (
    <div className="grid gap-8">
      <PageHeader
        title={t("users.page.title")}
        description={t("users.page.description")}
        actions={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void users.refetch()}
            disabled={users.isFetching}
          >
            <RefreshCw className={`me-2 size-4 ${users.isFetching ? "animate-spin" : ""}`} />
            {t("users.page.refreshList")}
          </Button>
        }
      />

      {canCreateUser ? <AddUserFormCard /> : null}
      {canCreateUser ? <SuperAdminCompaniesArchiveSection isSuperAdmin={canCreateUser} /> : null}
      {!canCreateUser ? (
        <InlineAlert variant="info">
          {t("users.page.superAdminOnly", { role: effectiveRole ?? t("users.page.unknownRole") })}
        </InlineAlert>
      ) : null}

      <Card className="border-card-border shadow-sm">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="text-base">{t("users.page.filterTitle")}</CardTitle>
            <CardDescription>
              {t("users.page.filterDescription")}
            </CardDescription>
          </div>
          <div className="grid gap-1">
            <Label className="text-xs text-muted">{t("users.page.roleLabel")}</Label>
            <select
              className="h-10 min-w-[200px] rounded-lg border border-card-border bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {USER_ROLE_FILTER_OPTIONS.map((r) => (
                <option key={r || "all"} value={r}>
                  {r ? userRoleLabel(r) : t("common.all")}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {users.isLoading ? (
            <p className="text-sm text-muted">{t("common.loading")}</p>
          ) : users.isError ? (
            <p className="text-sm text-red-600">{(users.error as Error).message}</p>
          ) : (
            (users.data?.items ?? []).map((u) => (
              <UserCard
                key={u.id}
                user={u}
                canToggleActive={canToggleUserActive}
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
