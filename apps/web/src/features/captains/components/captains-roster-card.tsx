import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BarChart3, CreditCard, ListChecks, Pencil, SlidersHorizontal, Trash2 } from "lucide-react";
import { useCaptains, useDeleteCaptain, useToggleCaptain } from "@/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { availabilityAr } from "@/features/captains/lib/availability-ar";
import { api } from "@/lib/api/singleton";
import { queryKeys } from "@/lib/api/query-keys";
import { toastApiError, toastSuccess } from "@/lib/toast";
import type { CaptainListItem } from "@/types/api";

type Props = {
  onOpenReport: (c: CaptainListItem) => void;
  onOpenEdit: (c: CaptainListItem) => void;
  canDelete: boolean;
};

export function CaptainsRosterCard({ onOpenReport, onOpenEdit, canDelete }: Props) {
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
    const amount = askAmount(`شحن رصيد ${c.user.fullName}`);
    if (amount == null || amount <= 0) return;
    const note = window.prompt("ملاحظة اختيارية") ?? undefined;
    charge.mutate({ id: c.id, amount, note });
  }

  function adjustBalance(c: CaptainListItem) {
    const amount = askAmount(`تعديل رصيد ${c.user.fullName} (يمكن إدخال قيمة سالبة)`);
    if (amount == null || amount === 0) return;
    const note = window.prompt("سبب التعديل مطلوب");
    if (!note?.trim()) {
      window.alert("سبب التعديل مطلوب");
      return;
    }
    adjustment.mutate({ id: c.id, amount, note });
  }

  async function showLedger(c: CaptainListItem) {
    try {
      const ledger = await api.captains.prepaidTransactions(c.id, { page: 1, pageSize: 8 });
      const lines = ledger.items.map(
        (x) =>
          `${new Date(x.createdAt).toLocaleString("ar-SA")} | ${x.type} | ${x.amount} ILS | بعد الحركة ${x.balanceAfter}`,
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
                <div className="mt-3 grid gap-2 rounded-lg border border-card-border bg-background/70 p-3 text-xs sm:grid-cols-3">
                  <div>
                    <span className="text-muted">الرصيد المتبقي</span>
                    <div className="mt-1 font-semibold text-foreground">{c.prepaidBalance ?? "0.00"} ILS</div>
                  </div>
                  <div>
                    <span className="text-muted">نسبة العمولة</span>
                    <div className="mt-1 font-semibold text-foreground">{c.commissionPercent ?? "افتراضي"}%</div>
                  </div>
                  <div>
                    <span className="text-muted">إجمالي الخصم</span>
                    <div className="mt-1 font-semibold text-foreground">{c.totalDeducted ?? "0.00"} ILS</div>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="default" size="sm" disabled={charge.isPending} onClick={() => chargeBalance(c)}>
                  <CreditCard className="size-4" />
                  شحن الرصيد
                </Button>
                <Button type="button" variant="secondary" size="sm" disabled={adjustment.isPending} onClick={() => adjustBalance(c)}>
                  <SlidersHorizontal className="size-4" />
                  تعديل
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => void showLedger(c)}>
                  <ListChecks className="size-4" />
                  سجل الحركات
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => onOpenReport(c)}>
                  <BarChart3 className="size-4" />
                  تقرير
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => onOpenEdit(c)}>
                  <Pencil className="size-4" />
                  تعديل
                </Button>
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
  );
}
