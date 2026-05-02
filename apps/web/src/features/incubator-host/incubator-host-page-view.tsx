import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate } from "react-router-dom";
import { AlertTriangle, ClipboardList } from "lucide-react";
import { isRtlLang } from "@/i18n/i18n";
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
import { useBranches, useCompaniesForSuperAdmin, useIncubatorCreateOrderWithDistribution, useStores } from "@/hooks";
import { buildIncubatorOrderNotes } from "@/features/incubator-host/incubator-order-notes";
import { canAccessIncubatorHost, isSuperAdminRole } from "@/lib/rbac-roles";
import { useAuthStore } from "@/stores/auth-store";

function useDispatchRole() {
  const role = useAuthStore((s) => s.user?.role);
  return canAccessIncubatorHost(role);
}

function fieldClass(err?: string) {
  return err ? "border-red-500 focus-visible:ring-red-300" : "";
}

export function IncubatorHostPageView() {
  const { t, i18n } = useTranslation();
  const textDir = isRtlLang(i18n.resolvedLanguage ?? i18n.language) ? "rtl" : "ltr";
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const canAccess = useDispatchRole();
  const navigate = useNavigate();
  const create = useIncubatorCreateOrderWithDistribution();
  const isSuperAdmin = isSuperAdminRole(user?.role);

  const [raw, setRaw] = useState("");
  const [parseSnapshot, setParseSnapshot] = useState<IncubatorParseResult | null>(null);
  const [draft, setDraft] = useState<IncubatorOrderDraft | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(user?.companyId ?? "");
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");

  const companiesQ = useCompaniesForSuperAdmin({ enabled: isSuperAdmin });
  const incubatorBranches = useBranches(isSuperAdmin ? selectedCompanyId : undefined, {
    enabled: isSuperAdmin && Boolean(selectedCompanyId.trim()),
  });
  const storesQ = useStores(1, 500, {
    enabled: !isSuperAdmin || Boolean(selectedCompanyId),
    companyId: isSuperAdmin ? selectedCompanyId : undefined,
  });

  useEffect(() => {
    if (!isSuperAdmin) {
      setSelectedCompanyId(user?.companyId ?? "");
      return;
    }
    if (!selectedCompanyId && companiesQ.data?.length) {
      setSelectedCompanyId(companiesQ.data[0]?.id ?? "");
    }
  }, [isSuperAdmin, user?.companyId, selectedCompanyId, companiesQ.data]);

  useEffect(() => {
    setSelectedBranchId("");
  }, [selectedCompanyId]);

  const validation = useMemo(() => (draft ? validateIncubatorDraft(draft) : null), [draft]);
  const canCreate = validation?.isValid ?? false;
  const canCreateTenant = !isSuperAdmin || Boolean(selectedCompanyId.trim());
  const missingLabels = useMemo(() => (draft ? listInvalidRequiredPreviewFields(draft) : []), [draft]);
  const stores = storesQ.data?.items ?? [];
  const restaurantName = parseSnapshot?.fields.restaurantName?.trim() ?? "";

  const suggestedStores = useMemo(() => {
    const q = restaurantName.trim().toLowerCase();
    if (!q) return [];
    return stores.filter((s) => {
      const n = s.name.trim().toLowerCase();
      return n === q || n.includes(q) || q.includes(n);
    });
  }, [restaurantName, stores]);

  useEffect(() => {
    if (!stores.length) {
      setSelectedStoreId("");
      return;
    }
    setSelectedStoreId((prev) => {
      if (prev && stores.some((s) => s.id === prev)) return prev;
      if (suggestedStores.length === 1) return suggestedStores[0]?.id ?? "";
      return "";
    });
  }, [stores, suggestedStores]);

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
    if (isSuperAdmin && !selectedCompanyId.trim()) return;

    const amount = Number(draft.amount.replace(",", ".").trim());
    const notes = buildIncubatorOrderNotes(draft.notes, raw);
    create.mutate(
      {
        ...(selectedStoreId ? { storeId: selectedStoreId } : {}),
        ...(isSuperAdmin && selectedCompanyId.trim()
          ? {
              companyId: selectedCompanyId.trim(),
              ...(selectedBranchId.trim() ? { branchId: selectedBranchId.trim() } : {}),
            }
          : {}),
        customerName: draft.customerName.trim(),
        customerPhone: draft.customerPhone.trim(),
        pickupAddress: draft.pickupAddress.trim(),
        dropoffAddress: draft.dropoffAddress.trim(),
        area: draft.area.trim(),
        amount,
        deliveryFee: 0,
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
      <PageHeader title={t("incubator.page.title")} description={t("incubator.page.description")} />

      <Card className="border-card-border shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-base">نطاق الشركة والمتجر</CardTitle>
          <p className="text-xs text-muted">كل إدخال في الأم الحاضنة يُنشئ طلبًا ضمن الشركة المختارة فقط.</p>
        </CardHeader>
        <CardContent className="grid gap-3" dir={textDir}>
          {isSuperAdmin ? (
            <div className="grid gap-1.5">
              <Label htmlFor="incubator-company">الشركة</Label>
              <select
                id="incubator-company"
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="h-10 rounded-md border border-card-border bg-background px-3 text-sm"
              >
                <option value="">{companiesQ.isLoading ? "جاري تحميل الشركات..." : "اختر الشركة"}</option>
                {(companiesQ.data ?? []).map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {isSuperAdmin ? (
            <div className="grid gap-1.5">
              <Label htmlFor="incubator-branch">الفرع (اختياري)</Label>
              <select
                id="incubator-branch"
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                disabled={incubatorBranches.isLoading || !selectedCompanyId.trim() || (incubatorBranches.data?.length ?? 0) === 0}
                className="h-10 rounded-md border border-card-border bg-background px-3 text-sm disabled:opacity-60"
              >
                <option value="">—</option>
                {(incubatorBranches.data ?? []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="grid gap-1.5">
            <Label htmlFor="incubator-store">المتجر / المطعم</Label>
            <select
              id="incubator-store"
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              disabled={storesQ.isLoading || stores.length === 0}
              className="h-10 rounded-md border border-card-border bg-background px-3 text-sm disabled:opacity-60"
            >
              <option value="">
                {storesQ.isLoading
                  ? "جاري تحميل المتاجر..."
                  : stores.length
                    ? "اختر متجرًا من نفس الشركة"
                    : "لا توجد متاجر متاحة ضمن الشركة"}
              </option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
            {restaurantName ? (
              <p className="text-xs text-muted">
                المطعم المستخرج: <span className="font-medium text-foreground">{restaurantName}</span>
                {suggestedStores.length
                  ? ` — تم إيجاد ${suggestedStores.length} مطابقة داخل نفس الشركة فقط.`
                  : " — لا توجد مطابقة تلقائية داخل نفس الشركة، الرجاء اختيار المتجر يدويًا."}
              </p>
            ) : (
              <p className="text-xs text-muted">سيتم مطابقة اسم المطعم تلقائيًا داخل نفس الشركة فقط عند التحليل.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-2" dir={textDir}>
        <Label htmlFor="incubator-raw">{t("incubator.raw.label")}</Label>
        <Textarea
          id="incubator-raw"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={t("incubator.raw.placeholder")}
          dir="auto"
          spellCheck={false}
          className="min-h-[min(32vh,360px)] resize-y font-mono text-sm leading-relaxed"
          aria-label={t("incubator.raw.aria")}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={runParse}>
            <ClipboardList className="size-4 opacity-90" />
            {t("incubator.actions.parse")}
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
              {t("incubator.actions.clearPreview")}
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
          <div className="min-w-0" dir={textDir}>
            <p className="font-semibold">{t("incubator.warningsTitle")}</p>
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
            <CardTitle className="text-base">{t("incubator.preview.title")}</CardTitle>
            <p className="text-xs text-muted">{t("incubator.preview.description")}</p>
          </CardHeader>
          <CardContent className="grid gap-4" dir={textDir}>
            {missingLabels.length > 0 ? (
              <div
                className="rounded-lg border border-red-600/35 bg-red-500/10 px-3 py-2 text-sm text-red-950 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100"
                role="status"
              >
                <span className="font-semibold">{t("incubator.missing.label")}</span>
                <span>{missingLabels.join(`, `)}</span>
              </div>
            ) : (
              <p className="text-xs font-medium text-emerald-800 dark:text-emerald-200">
                {t("incubator.allRequiredOk")}
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="pv-customerName">{t("incubator.fieldLabels.customerName")}</Label>
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
                <Label htmlFor="pv-phone">{t("incubator.fieldLabels.customerPhone")}</Label>
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
                <Label htmlFor="pv-pickup">{t("incubator.fieldLabels.pickupAddress")}</Label>
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
                <Label htmlFor="pv-dropoff">{t("incubator.fieldLabels.dropoffAddress")}</Label>
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
                <Label htmlFor="pv-area">{t("incubator.fieldLabels.area")}</Label>
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
                <Label htmlFor="pv-amount">{t("incubator.fieldLabels.amount")}</Label>
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
                <Label htmlFor="pv-notes">{t("incubator.fieldLabels.notes")}</Label>
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
                {t("incubator.actions.cancel")}
              </Button>
              <Button type="button" disabled={!canCreate || !canCreateTenant || create.isPending} onClick={onCreate}>
                {create.isPending ? t("incubator.actions.creating") : t("incubator.actions.create")}
              </Button>
            </div>
            {create.isError ? <p className="text-sm text-red-600">{(create.error as Error).message}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      {parseSnapshot ? (
        <details className="rounded-lg border border-card-border bg-card/50 text-sm" dir={textDir}>
          <summary className="cursor-pointer px-3 py-2 font-medium">{t("incubator.parseLog")}</summary>
          <pre className="max-h-48 overflow-auto border-t border-card-border p-3 font-mono text-[11px] leading-relaxed">
            {parseSnapshot.log.length ? parseSnapshot.log.join("\n") : "—"}
          </pre>
        </details>
      ) : null}
    </div>
  );
}
