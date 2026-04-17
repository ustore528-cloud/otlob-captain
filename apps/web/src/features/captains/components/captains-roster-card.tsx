import { BarChart3, Pencil, Trash2 } from "lucide-react";
import { useCaptains, useDeleteCaptain, useToggleCaptain } from "@/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { availabilityAr } from "@/features/captains/lib/availability-ar";
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
              </div>
              <div className="flex flex-wrap gap-2">
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
