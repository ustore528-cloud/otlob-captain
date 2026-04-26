import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BarChart3, CreditCard, ListChecks, Pencil, SlidersHorizontal, Trash2 } from "lucide-react";
import { useCaptains, useDeleteCaptain, useToggleCaptain } from "@/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CaptainBalanceAdjustmentModal } from "@/features/captains/components/captain-balance-adjustment-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { LoadingBlock } from "@/components/ui/loading-block";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/ui/status-badge";
import { availabilityAr } from "@/features/captains/lib/availability-ar";
import { CompanyAdminCaptainPrepaidModal } from "@/features/finance/components/company-admin-captain-prepaid-modal";
import { api } from "@/lib/api/singleton";
import { queryKeys } from "@/lib/api/query-keys";
import { isCompanyAdminRole } from "@/lib/rbac-roles";
import { useAuthStore } from "@/stores/auth-store";
import { toastApiError, toastSuccess } from "@/lib/toast";
import type { CaptainListItem } from "@/types/api";
import { useState } from "react";

type Props = {
  onOpenReport: (c: CaptainListItem) => void;
  onOpenEdit: (c: CaptainListItem) => void;
  canManage: boolean;
  canDelete: boolean;
};

const ILS_LABEL = "ILS";
const ILS_SYMBOL = "₪";

function formatIls(value: string | number | null | undefined): string {
  const num = Number(value ?? 0);
  return `${num.toFixed(2)} ${ILS_SYMBOL}`;
}

export function CaptainsRosterCard({ onOpenReport, onOpenEdit, canManage, canDelete }: Props) {
  const role = useAuthStore((s) => s.user?.role);
  const isCompanyAdmin = isCompanyAdminRole(role);
  const [adjustTarget, setAdjustTarget] = useState<CaptainListItem | null>(null);
  const [caPrepaidTarget, setCaPrepaidTarget] = useState<CaptainListItem | null>(null);
  const captains = useCaptains({ page: 1, pageSize: 100 });
  const toggle = useToggleCaptain();
  const del = useDeleteCaptain();
  const qc = useQueryClient();
  const charge = useMutation({
    mutationFn: ({ id, amount, note }: { id: string; amount: number; note?: string }) =>
      api.captains.prepaidCharge(id, { amount, note }),
    onSuccess: async () => {
      toastSuccess("تم شحن الرصيد بنجاح");
      await qc.invalidateQueries({ queryKey: queryKeys.captains.root });
    },
    onError: (err) => toastApiError(err, "تعذر شحن رصيد الكابتن"),
  });
  const adjustment = useMutation({
    mutationFn: ({ id, amount, note }: { id: string; amount: number; note: string }) =>
      api.captains.prepaidAdjustment(id, { amount, note }),
    onSuccess: async () => {
      toastSuccess("تم تسجيل تعديل الرصيد");
      await qc.invalidateQueries({ queryKey: queryKeys.captains.root });
    },
    onError: (err) => toastApiError(err, "تعذر تعديل الرصيد"),
  });

  function askAmount(label: string) {
    const raw = window.prompt(label);
    if (raw == null) return null;
    const amount = Number(raw.replace(",", "."));
    if (!Number.isFinite(amount)) {
      window.alert("أدخل مبلغًا صحيحًا");
      return null;
    }
    return amount;
  }

  function chargeBalance(c: CaptainListItem) {
    if (isCompanyAdmin) {
      setCaPrepaidTarget(c);
      return;
    }
    const amount = askAmount(`شحن رصيد ${c.user.fullName}`);
    if (amount == null || amount <= 0) return;
    const note = window.prompt("ملاحظة اختيارية") ?? undefined;
    charge.mutate({ id: c.id, amount, note });
  }

  async function showLedger(c: CaptainListItem) {
    try {
      const ledger = await api.captains.prepaidTransactions(c.id, { page: 1, pageSize: 8 });
      const lines = ledger.items.map(
        (x) =>
          `${new Date(x.createdAt).toLocaleString("ar-SA")} | ${x.type} | ${formatIls(x.amount)} (${ILS_LABEL}) | بعد الحركة ${formatIls(x.balanceAfter)}`,
      );
      window.alert(lines.length ? lines.join("\n") : "لا توجد حركات رصيد بعد");
    } catch (err) {
      toastApiError(err, "تعذر تحميل سجل الحركات");
    }
  }

  function confirmDelete(c: CaptainListItem) {
    const ok = window.confirm(
      `حذف الكابتن «${c.user.fullName}» وحساب الدخول نهائياً؟\n` +
        "سيتم إزالة ربط الطلبات المسلّمة أو الملغاة بهذا الكابتن، وحذف سجل التعيينات والمواقع. لا يمكن الحذف إن وُجدت طلبات قيد التنفيذ.",
    );
    if (!ok) return;
    del.mutate(c.id);
  }

  return (
    <Card className="border-card-border shadow-sm ring-1 ring-card-border/70">
      <CardHeader className="border-b border-card-border/70 pb-5">
        <CardTitle className="text-base">القائمة</CardTitle>
        <CardDescription>{captains.data ? `${captains.data.total} كابتن` : "—"}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 pt-4">
        {captains.isLoading ? (
          <LoadingBlock message="جارٍ تحميل قائمة الكباتن…" compact />
        ) : captains.isError ? (
          <InlineAlert variant="error">{(captains.error as Error).message}</InlineAlert>
        ) : (captains.data?.items ?? []).length === 0 ? (
          <EmptyState title="لا يوجد كباتن بعد" description="ابدأ بإضافة كابتن جديد ليظهر في هذه القائمة." className="py-10" />
        ) : (
          (captains.data?.items ?? []).map((c: CaptainListItem) => (
            <div
              key={c.id}
              className="flex flex-col gap-3 rounded-xl border border-card-border bg-card p-4 shadow-sm ring-1 ring-card-border/50 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{c.user.fullName}</span>
                  <StatusBadge tone={c.isActive && c.user.isActive ? "positive" : "neutral"}>
                    {c.isActive && c.user.isActive ? "نشط" : "موقوف"}
                  </StatusBadge>
                  <StatusBadge tone="info">{availabilityAr(c.availabilityStatus)}</StatusBadge>
                </div>
                <div className="mt-1 text-sm text-muted" dir="ltr">
                  {c.user.phone}
                </div>
                <div className="mt-2 text-xs text-muted">
                  {c.vehicleType} — {c.area}
                </div>
                <div className="mt-2 text-xs text-muted">
                  مشرف الكابتن:{" "}
                  {c.supervisorUser ? (
                    <>
                      <span className="text-foreground">{c.supervisorUser.fullName}</span>
                      <span className="mx-1 text-muted">·</span>
                      <span dir="ltr">{c.supervisorUser.phone}</span>
                    </>
                  ) : (
                    <span>لا يوجد مشرف</span>
                  )}
                </div>
                <div className="mt-3 grid gap-2 rounded-lg border border-card-border bg-background/70 p-3 text-xs sm:grid-cols-3">
                  <StatTile label={`الرصيد المتبقي (${ILS_LABEL})`} value={Number(c.prepaidBalance ?? 0)} />
                  <div className="rounded-lg border border-card-border bg-muted/15 p-3 text-sm shadow-sm">
                    <div className="text-muted">نسبة العمولة</div>
                    <div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                      {c.commissionPercent ?? "افتراضي"}%
                    </div>
                  </div>
                  <StatTile label={`إجمالي الخصم (${ILS_LABEL})`} value={Number(c.totalDeducted ?? 0)} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {canManage ? (
                  <Button type="button" variant="default" size="sm" disabled={charge.isPending} onClick={() => chargeBalance(c)}>
                    <CreditCard className="size-4" />
                    شحن الرصيد
                  </Button>
                ) : null}
                {canManage ? (
                  <Button type="button" variant="secondary" size="sm" disabled={adjustment.isPending} onClick={() => setAdjustTarget(c)}>
                    <SlidersHorizontal className="size-4" />
                    تعديل
                  </Button>
                ) : null}
                <Button type="button" variant="ghost" size="sm" onClick={() => void showLedger(c)}>
                  <ListChecks className="size-4" />
                  سجل الحركات
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => onOpenReport(c)}>
                  <BarChart3 className="size-4" />
                  تقرير
                </Button>
                {canManage ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => onOpenEdit(c)}>
                    <Pencil className="size-4" />
                    تعديل
                  </Button>
                ) : null}
                {canDelete ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={del.isPending}
                    onClick={() => confirmDelete(c)}
                  >
                    <Trash2 className="size-4" />
                    حذف
                  </Button>
                ) : null}
                {canManage ? (
                  <Button
                    type="button"
                    size="sm"
                    variant={c.isActive ? "secondary" : "default"}
                    disabled={toggle.isPending}
                    onClick={() => toggle.mutate({ id: c.id, isActive: !c.isActive })}
                  >
                    {c.isActive ? "تعطيل" : "تفعيل"}
                  </Button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </CardContent>
      <CaptainBalanceAdjustmentModal
        open={Boolean(adjustTarget)}
        captainLabel={adjustTarget?.user.fullName ?? ""}
        isPending={adjustment.isPending}
        onClose={() => setAdjustTarget(null)}
        onSubmit={({ amount, note }) => {
          if (!adjustTarget) return;
          adjustment.mutate(
            { id: adjustTarget.id, amount, note },
            { onSuccess: () => setAdjustTarget(null) },
          );
        }}
      />
      {isCompanyAdmin ? (
        <CompanyAdminCaptainPrepaidModal
          open={Boolean(caPrepaidTarget)}
          onClose={() => setCaPrepaidTarget(null)}
          defaultCaptainId={caPrepaidTarget?.id ?? null}
        />
      ) : null}
    </Card>
  );
}
