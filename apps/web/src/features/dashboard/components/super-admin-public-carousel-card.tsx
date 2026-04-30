import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageIcon, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  getCompanyPublicPageSettingsById,
  patchCompanyPublicPageCarousel,
  type PublicCarouselSlideInput,
} from "@/lib/api/services/companies";
import { useCompaniesForSuperAdmin } from "@/hooks";
import { useAuthStore } from "@/stores/auth-store";

type Row = PublicCarouselSlideInput;

function newRow(): Row {
  return { id: `s-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())}`, imageUrl: "", alt: "" };
}

export function SuperAdminPublicCarouselCard() {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  const companiesQ = useCompaniesForSuperAdmin({ enabled: Boolean(token) });
  const [companyId, setCompanyId] = useState("");
  const [rows, setRows] = useState<Row[]>([newRow()]);

  const settingsQ = useQuery({
    queryKey: ["company", "public-page-settings", "super-admin", companyId],
    queryFn: () => getCompanyPublicPageSettingsById(token!, companyId),
    enabled: Boolean(token) && companyId.trim() !== "",
  });

  useEffect(() => {
    if (!settingsQ.data?.carouselSlides) return;
    const imgs = settingsQ.data.carouselSlides
      .filter((s) => s.imageUrl && s.imageUrl.startsWith("https://"))
      .map((s) => ({
        id: s.id,
        imageUrl: s.imageUrl!,
        alt: s.alt || "",
      }));
    setRows(imgs.length > 0 ? imgs : [newRow()]);
  }, [settingsQ.data]);

  /** صفوف فارغة أو غير HTTPS تُهمل؛ يمكن حفظ مصفوفة فارغة لمسح السليكر من جهة الزبائن. */
  const validPayload = useMemo(() => {
    const slides = rows
      .map((r) => ({
        id: r.id.trim() || "slide",
        imageUrl: r.imageUrl.trim(),
        alt: r.alt?.trim() ?? "",
      }))
      .filter((r) => r.imageUrl.startsWith("https://"));
    return { carouselSlides: slides } as { carouselSlides: PublicCarouselSlideInput[] };
  }, [rows]);

  const mutate = useMutation({
    mutationFn: () => patchCompanyPublicPageCarousel(token!, companyId, validPayload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["company", "public-page-settings", "super-admin", companyId] });
    },
  });

  if (!token) return null;

  return (
    <Card className="border-card-border shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ImageIcon className="size-4 text-primary" aria-hidden />
          سليكر صور صفحة «اطلب كابتن» (سوبر أدمن)
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          أضف روابط صور <strong>HTTPS</strong> فقط لكل شركة. يظهر السليكر للعملاء بنفس حجم البطاقة السابقة؛ مدير الشركة لا يستطيع
          تعديل الصور من لوحته.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-2">
          <Label htmlFor="sa-carousel-co">الشركة</Label>
          <select
            id="sa-carousel-co"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={companyId}
            onChange={(e) => {
              setCompanyId(e.target.value);
              setRows([newRow()]);
            }}
          >
            <option value="">— اختر شركة —</option>
            {(companiesQ.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {companyId ? (
          <>
            {settingsQ.isLoading ? <p className="text-sm text-muted-foreground">جاري التحميل…</p> : null}
            {settingsQ.error ? <p className="text-sm text-destructive">{(settingsQ.error as Error)?.message}</p> : null}

            <div className="space-y-3">
              {rows.map((row, idx) => (
                <div
                  key={`${row.id}-${idx}`}
                  className="grid gap-2 rounded-xl border border-dashed border-card-border p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                >
                  <div className="grid gap-1">
                    <Label className="text-xs">رابط الصورة (HTTPS)</Label>
                    <Input
                      placeholder="https://…"
                      value={row.imageUrl}
                      onChange={(e) => {
                        const v = e.target.value;
                        setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, imageUrl: v } : r)));
                      }}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">وصف مختصر (اختياري)</Label>
                    <Input
                      placeholder="نص بديل للصورة"
                      value={row.alt ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, alt: v } : r)));
                      }}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    aria-label="حذف"
                    onClick={() => setRows((prev) => (prev.length <= 1 ? [newRow()] : prev.filter((_, i) => i !== idx)))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="secondary"
              onClick={() => setRows((prev) => [...prev, newRow()])}
            >
              <Plus className="me-2 size-4" aria-hidden />
              إضافة شريحة
            </Button>

            <Button type="button" disabled={mutate.isPending} onClick={() => mutate.mutate()}>
              <Save className="me-2 size-4" aria-hidden />
              {mutate.isPending ? "جاري الحفظ…" : "حفظ السليكر"}
            </Button>
            {validPayload.carouselSlides.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                لا توجد شرائح صالحة؛ عند الحفظ يُزال السليكر من صفحة الطلب لهذه الشركة.
              </p>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
