import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AlertTriangle, ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  draftFromParsed,
  listInvalidRequiredPreviewFields,
  validateIncubatorDraft,
  type IncubatorOrderDraft,
} from "@/features/incubator-host/incubator-order-draft";
import { parseIncubatorRawOrder, type IncubatorParseResult } from "@/features/incubator-host/parse-incubator-order";
import { useIncubatorCreateOrderWithDistribution } from "@/hooks";
import { buildIncubatorOrderNotes } from "@/features/incubator-host/incubator-order-notes";
import { canAccessIncubatorHost } from "@/lib/rbac-roles";
import { useAuthStore } from "@/stores/auth-store";

function useDispatchRole() {
  const role = useAuthStore((s) => s.user?.role);
  return canAccessIncubatorHost(role);
}

function fieldClass(err?: string) {
  return err ? "border-red-500 focus-visible:ring-red-300" : "";
}

export function IncubatorHostPageView() {
  const token = useAuthStore((s) => s.token);
  const canAccess = useDispatchRole();
  const navigate = useNavigate();
  const create = useIncubatorCreateOrderWithDistribution();

  const [raw, setRaw] = useState("");
  const [parseSnapshot, setParseSnapshot] = useState<IncubatorParseResult | null>(null);
  const [draft, setDraft] = useState<IncubatorOrderDraft | null>(null);

  const validation = useMemo(() => (draft ? validateIncubatorDraft(draft) : null), [draft]);
  const canCreate = validation?.isValid ?? false;
  const missingLabels = useMemo(() => (draft ? listInvalidRequiredPreviewFields(draft) : []), [draft]);

  const updateDraft = (patch: Partial<IncubatorOrderDraft>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const runParse = () => {
    const result = parseIncubatorRawOrder(raw);
    setParseSnapshot(result);
    setDraft(draftFromParsed(result));
  };

  const onCreate = () => {
    if (!draft) return;
    const v = validateIncubatorDraft(draft);
    if (!v.isValid) return;

    const amount = Number(draft.amount.replace(",", ".").trim());
    const notes = buildIncubatorOrderNotes(draft.notes, raw);
    create.mutate(
      {
        customerName: draft.customerName.trim(),
        customerPhone: draft.customerPhone.trim(),
        pickupAddress: draft.pickupAddress.trim(),
        dropoffAddress: draft.dropoffAddress.trim(),
        area: draft.area.trim(),
        amount,
        notes,
        distributionMode: "AUTO",
      },
      {
        onSuccess: () => void navigate("/orders"),
      },
    );
  };

  const fieldErr = (key: keyof IncubatorOrderDraft) => validation?.errors[key];

  if (!token) return null;
  if (!canAccess) return <Navigate to="/" replace />;

  return (
    <div className="grid gap-6">
      <PageHeader
        title="الأم الحاضنة"
        description="الصق النص ثم تحليل — راجع المعاينة، ثم أنشئ الطلب. يُنشأ كطلب عادي (AUTO) ويُستدعى التوزيع التلقائي كما من قائمة الطلبات."
      />

      <div className="grid gap-2 [direction:rtl]">
        <Label htmlFor="incubator-raw">النص الخام</Label>
        <Textarea
          id="incubator-raw"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="الصق معلومات الطلب هنا…"
          dir="auto"
          spellCheck={false}
          className="min-h-[min(32vh,360px)] resize-y font-mono text-sm leading-relaxed"
          aria-label="نص الطلب الخام"
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={runParse}>
            <ClipboardList className="size-4 opacity-90" />
            تحليل وملء المعاينة
          </Button>
          {draft ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDraft(null);
                setParseSnapshot(null);
              }}
            >
              مسح المعاينة
            </Button>
          ) : null}
        </div>
      </div>

      {parseSnapshot && parseSnapshot.warnings.length > 0 ? (
        <div
          className="flex gap-2 rounded-lg border border-amber-600/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-100"
          role="status"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0 [direction:rtl]">
            <p className="font-semibold">تنبيهات التحليل</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs leading-relaxed">
              {parseSnapshot.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {draft ? (
        <Card className="border-card-border shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-base">معاينة الطلب قبل الإنشاء</CardTitle>
            <p className="text-xs text-muted">
              الحقول الإلزامية: اسم العميل، الهاتف، عنوان الاستلام والتسليم، المنطقة، السعر. بعد الإنشاء يُجرى «توزيع تلقائي»
              تلقائياً ليدخل الطلب نفس مسار الكباتن المعتاد.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 [direction:rtl]">
            {missingLabels.length > 0 ? (
              <div
                className="rounded-lg border border-red-600/35 bg-red-500/10 px-3 py-2 text-sm text-red-950 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100"
                role="status"
              >
                <span className="font-semibold">ناقص أو غير صالح: </span>
                <span>{missingLabels.join("، ")}</span>
              </div>
            ) : (
              <p className="text-xs font-medium text-emerald-800 dark:text-emerald-200">الحقول الإلزامية مكتملة — يمكن الإنشاء.</p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="pv-customerName">اسم العميل</Label>
                <Input
                  id="pv-customerName"
                  value={draft.customerName}
                  onChange={(e) => updateDraft({ customerName: e.target.value })}
                  className={fieldClass(fieldErr("customerName"))}
                  maxLength={200}
                  autoComplete="name"
                />
                {fieldErr("customerName") ? <p className="text-xs text-red-600">{fieldErr("customerName")}</p> : null}
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="pv-phone">هاتف العميل</Label>
                <Input
                  id="pv-phone"
                  value={draft.customerPhone}
                  onChange={(e) => updateDraft({ customerPhone: e.target.value })}
                  dir="ltr"
                  className={`text-left font-mono ${fieldClass(fieldErr("customerPhone"))}`}
                  inputMode="tel"
                />
                {fieldErr("customerPhone") ? <p className="text-xs text-red-600">{fieldErr("customerPhone")}</p> : null}
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="pv-pickup">عنوان الاستلام</Label>
                <Input
                  id="pv-pickup"
                  value={draft.pickupAddress}
                  onChange={(e) => updateDraft({ pickupAddress: e.target.value })}
                  maxLength={500}
                  className={fieldClass(fieldErr("pickupAddress"))}
                />
                {fieldErr("pickupAddress") ? <p className="text-xs text-red-600">{fieldErr("pickupAddress")}</p> : null}
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="pv-dropoff">عنوان التسليم</Label>
                <Input
                  id="pv-dropoff"
                  value={draft.dropoffAddress}
                  onChange={(e) => updateDraft({ dropoffAddress: e.target.value })}
                  maxLength={500}
                  className={fieldClass(fieldErr("dropoffAddress"))}
                />
                {fieldErr("dropoffAddress") ? <p className="text-xs text-red-600">{fieldErr("dropoffAddress")}</p> : null}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="pv-area">المنطقة</Label>
                <Input
                  id="pv-area"
                  value={draft.area}
                  onChange={(e) => updateDraft({ area: e.target.value })}
                  maxLength={200}
                  className={fieldClass(fieldErr("area"))}
                />
                {fieldErr("area") ? <p className="text-xs text-red-600">{fieldErr("area")}</p> : null}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="pv-amount">سعر الطلب</Label>
                <Input
                  id="pv-amount"
                  value={draft.amount}
                  onChange={(e) => updateDraft({ amount: e.target.value })}
                  dir="ltr"
                  inputMode="decimal"
                  className={`font-mono ${fieldClass(fieldErr("amount"))}`}
                />
                {fieldErr("amount") ? <p className="text-xs text-red-600">{fieldErr("amount")}</p> : null}
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="pv-notes">ملاحظات (اختياري)</Label>
                <Textarea
                  id="pv-notes"
                  value={draft.notes}
                  onChange={(e) => updateDraft({ notes: e.target.value })}
                  rows={3}
                  maxLength={2000}
                  className="min-h-[4.5rem]"
                />
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-card-border pt-4">
              <Button type="button" variant="secondary" onClick={() => void navigate("/orders")}>
                إلغاء
              </Button>
              <Button type="button" disabled={!canCreate || create.isPending} onClick={onCreate}>
                {create.isPending ? "جارٍ الإنشاء…" : "إنشاء الطلب"}
              </Button>
            </div>
            {create.isError ? <p className="text-sm text-red-600">{(create.error as Error).message}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      {parseSnapshot ? (
        <details className="rounded-lg border border-card-border bg-card/50 text-sm [direction:rtl]">
          <summary className="cursor-pointer px-3 py-2 font-medium">سجل التحليل (للمشرف)</summary>
          <pre className="max-h-48 overflow-auto border-t border-card-border p-3 font-mono text-[11px] leading-relaxed">
            {parseSnapshot.log.length ? parseSnapshot.log.join("\n") : "—"}
          </pre>
        </details>
      ) : null}
    </div>
  );
}
