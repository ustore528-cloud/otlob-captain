import { Navigate } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { useStores, useUpdateStore, useUsers } from "@/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FORM_CONTROL_CLASS } from "@/components/ui/form-field-classes";
import { InlineAlert } from "@/components/ui/inline-alert";
import { LoadingBlock } from "@/components/ui/loading-block";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { TableShell } from "@/components/ui/table-shell";
import { isDispatchRole, isManagementAdminRole } from "@/lib/rbac-roles";
import { useAuthStore } from "@/stores/auth-store";
import type { StoreListItem, StoreSubscriptionType } from "@/types/api";

function subscriptionLabel(t: StoreSubscriptionType): string {
  return t === "PUBLIC" ? "عام" : "مرتبط بمشرف";
}

export function StoresPageView() {
  const role = useAuthStore((s) => s.user?.role);
  const me = useAuthStore((s) => s.user);
  const canManageStores = isManagementAdminRole(role);
  const stores = useStores(1, 100);
  const updateStore = useUpdateStore();
  const supervisorsBranch = useUsers({ page: 1, pageSize: 100, role: "BRANCH_MANAGER" });
  const supervisorsDispatch = useUsers({ page: 1, pageSize: 100, role: "DISPATCHER" });
  const supervisors = [
    ...(supervisorsBranch.data?.items ?? []),
    ...(supervisorsDispatch.data?.items ?? []),
  ];
  const [editStore, setEditStore] = useState<StoreListItem | null>(null);
  const [subscriptionType, setSubscriptionType] = useState<StoreSubscriptionType>("PUBLIC");
  const [supervisorUserId, setSupervisorUserId] = useState<string>("");

  if (!isDispatchRole(role)) return <Navigate to="/" replace />;

  const rows = stores.data?.items ?? [];

  return (
    <div className="grid gap-8">
      <PageHeader
        title="المتاجر"
        description="عرض اشتراك المتجر، المشرف المرتبط، والمنطقة الأساسية كما في الخادم."
        divider
        actions={
          <Button type="button" variant="secondary" size="sm" onClick={() => void stores.refetch()} disabled={stores.isFetching}>
            <RefreshCw className="size-4 opacity-80" />
            تحديث
          </Button>
        }
      />

      <Card className="border-card-border shadow-sm ring-1 ring-card-border/70">
        <CardHeader className="border-b border-card-border/70 pb-5">
          <CardTitle className="text-base">القائمة</CardTitle>
          <CardDescription>{stores.data ? `${stores.data.total} متجر` : "—"}</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {stores.isLoading ? (
            <LoadingBlock message="جارٍ تحميل المتاجر…" compact />
          ) : stores.isError ? (
            <InlineAlert variant="error">{(stores.error as Error).message}</InlineAlert>
          ) : rows.length === 0 ? (
            <EmptyState title="لا توجد متاجر لعرضها" description="يمكنك إعادة التحميل أو تعديل الصلاحيات/النطاق إن لزم." className="py-10" />
          ) : (
            <TableShell>
            <table className="w-full min-w-[720px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="bg-muted/30 text-muted">
                  <th className="border-b border-card-border px-3 py-2 text-right font-medium">المتجر</th>
                  <th className="border-b border-card-border px-3 py-2 text-right font-medium">الهاتف</th>
                  <th className="border-b border-card-border px-3 py-2 text-right font-medium">المنطقة</th>
                  <th className="border-b border-card-border px-3 py-2 text-right font-medium">الاشتراك</th>
                  <th className="border-b border-card-border px-3 py-2 text-right font-medium">المشرف</th>
                  <th className="border-b border-card-border px-3 py-2 text-right font-medium">المنطقة الأساسية</th>
                  <th className="border-b border-card-border px-3 py-2 text-right font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s: StoreListItem) => (
                  <tr key={s.id} className="hover:bg-accent/40">
                    <td className="border-b border-card-border px-3 py-3 align-top">
                      <div className="font-medium">{s.name}</div>
                      <div className="mt-1">
                        <StatusBadge tone={s.isActive ? "positive" : "neutral"}>
                          {s.isActive ? "نشط" : "موقوف"}
                        </StatusBadge>
                      </div>
                    </td>
                    <td className="border-b border-card-border px-3 py-3 align-top text-xs" dir="ltr">
                      {s.phone}
                    </td>
                    <td className="border-b border-card-border px-3 py-3 align-top text-xs">{s.area}</td>
                    <td className="border-b border-card-border px-3 py-3 align-top">
                      <StatusBadge tone="info">{subscriptionLabel(s.subscriptionType)}</StatusBadge>
                      <div className="mt-1 font-mono text-[10px] text-muted" dir="ltr">
                        {s.subscriptionType}
                      </div>
                    </td>
                    <td className="border-b border-card-border px-3 py-3 align-top text-xs">
                      {s.supervisorUser ? (
                        <>
                          <div className="font-medium">{s.supervisorUser.fullName}</div>
                          <div className="text-muted" dir="ltr">
                            {s.supervisorUser.phone}
                          </div>
                        </>
                      ) : (
                        <span className="text-muted">لا يوجد مشرف</span>
                      )}
                    </td>
                    <td className="border-b border-card-border px-3 py-3 align-top text-xs">
                      {s.primaryRegion ? (
                        <>
                          <div>{s.primaryRegion.name}</div>
                          <div className="text-muted" dir="ltr">
                            {s.primaryRegion.code}
                          </div>
                        </>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="border-b border-card-border px-3 py-3 align-top">
                      {canManageStores ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setEditStore(s);
                            setSubscriptionType(s.subscriptionType);
                            setSupervisorUserId(s.supervisorUser?.id ?? "");
                          }}
                        >
                          ضبط الاشتراك/المشرف
                        </Button>
                      ) : (
                        <span className="text-xs text-muted">عرض فقط</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </TableShell>
          )}
        </CardContent>
      </Card>

      <Modal
        open={Boolean(editStore)}
        onClose={() => setEditStore(null)}
        title="تحديث اشتراك المتجر"
        description={editStore ? `المتجر: ${editStore.name}` : ""}
      >
        <div className="grid gap-4">
          <div className="grid gap-2">
            <label className="text-sm text-muted">نوع الاشتراك</label>
            <select
              className={FORM_CONTROL_CLASS}
              value={subscriptionType}
              onChange={(e) => {
                const value = e.target.value as StoreSubscriptionType;
                setSubscriptionType(value);
                if (value === "PUBLIC") setSupervisorUserId("");
              }}
            >
              <option value="PUBLIC">PUBLIC — عام</option>
              <option value="SUPERVISOR_LINKED">SUPERVISOR_LINKED — مرتبط بمشرف</option>
            </select>
          </div>
          <div className="grid gap-2">
            <label className="text-sm text-muted">المشرف</label>
            {me?.role === "BRANCH_MANAGER" ? (
              <InlineAlert variant="info">كمشرف منطقة، سيتم ربط المتجر بحسابك تلقائياً عند اختيار SUPERVISOR_LINKED.</InlineAlert>
            ) : null}
            <select
              className={FORM_CONTROL_CLASS}
              value={supervisorUserId}
              onChange={(e) => setSupervisorUserId(e.target.value)}
              disabled={subscriptionType === "PUBLIC" || !canManageStores}
            >
              <option value="">بدون مشرف</option>
              {supervisors.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName} — {u.role}
                </option>
              ))}
            </select>
          </div>
          {subscriptionType === "SUPERVISOR_LINKED" && !supervisorUserId ? (
            <InlineAlert variant="warning">اشتراك SUPERVISOR_LINKED يتطلب اختيار مشرف.</InlineAlert>
          ) : null}
          {updateStore.isError ? <InlineAlert variant="error">{(updateStore.error as Error).message}</InlineAlert> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditStore(null)}>
              إلغاء
            </Button>
            <Button
              type="button"
              disabled={updateStore.isPending || (subscriptionType === "SUPERVISOR_LINKED" && !supervisorUserId)}
              onClick={() => {
                if (!editStore) return;
                const managerRole = me?.role;
                const managerId = me?.id;
                updateStore.mutate(
                  {
                    id: editStore.id,
                    body: {
                      subscriptionType,
                      supervisorUserId:
                        subscriptionType === "PUBLIC"
                          ? null
                          : managerRole === "BRANCH_MANAGER"
                            ? managerId ?? null
                            : supervisorUserId || null,
                    },
                  },
                  { onSuccess: () => setEditStore(null) },
                );
              }}
            >
              حفظ
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
