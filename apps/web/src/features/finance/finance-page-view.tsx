import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FORM_CONTROL_CLASS } from "@/components/ui/form-field-classes";
import { InlineAlert } from "@/components/ui/inline-alert";
import { LoadingBlock } from "@/components/ui/loading-block";
import { StatusBadge } from "@/components/ui/status-badge";
import { TableShell } from "@/components/ui/table-shell";
import { FinanceLedgerTable } from "@/features/finance/components/finance-ledger-table";
import { LedgerActivityReportSection } from "@/features/finance/components/ledger-activity-report-section";
import { CompanyAdminCaptainPrepaidModal } from "@/features/finance/components/company-admin-captain-prepaid-modal";
import { SuperAdminCompanyTopupModal } from "@/features/finance/components/super-admin-company-topup-modal";
import { SuperAdminStoreTopupModal } from "@/features/finance/components/super-admin-store-topup-modal";
import { SuperAdminSupervisorTopupModal } from "@/features/finance/components/super-admin-supervisor-topup-modal";
import { SupervisorCaptainTransferModal } from "@/features/finance/components/supervisor-captain-transfer-modal";
import { useCompaniesForSuperAdmin } from "@/hooks/companies/use-companies-for-super-admin";
import { useFinanceLedgerLoadMore } from "@/hooks/finance/use-finance-ledger-load-more";
import { useCaptains } from "@/hooks/captains/use-captains";
import { useStores } from "@/hooks/stores/use-stores";
import { ApiError } from "@/lib/api/http";
import { queryKeys } from "@/lib/api/query-keys";
import { api } from "@/lib/api/singleton";
import { queryClient } from "@/lib/query-client";
import {
  canAccessFinancePage,
  canReadCaptainWalletUi,
  canReadStoreWalletUi,
  canViewCompanyWalletSection,
  isCompanyAdminRole,
  isSuperAdminRole,
  isSupervisorFinanceRole,
} from "@/lib/rbac-roles";
import { useAuthStore } from "@/stores/auth-store";
import type { CompanyWalletReadDto, WalletBalanceReadDto } from "@/types/api";

type FinanceTab = "supervisor" | "store" | "captain" | "company";
const ILS_CODE = "ILS";
const ILS_SYMBOL = "₪";

function currencyLabel(currency: string): string {
  return currency === ILS_CODE ? `${ILS_SYMBOL} ${ILS_CODE}` : currency;
}

function companyLedgerTypeLabel(t: string): string {
  const map: Record<string, string> = {
    SUPER_ADMIN_TOP_UP: "شحن (مدير النظام)",
    WALLET_TRANSFER: "تحويل",
    ADJUSTMENT: "تسوية",
  };
  return map[t] ?? t;
}

function BalanceCard({ sub, data, isLoading, error }: {
  sub: string;
  data: WalletBalanceReadDto | undefined;
  isLoading: boolean;
  error: Error | null;
}) {
  if (isLoading) {
    return <LoadingBlock message="جارٍ تحميل الرصيد…" compact />;
  }
  if (error) {
    return <InlineAlert variant="error">{error.message}</InlineAlert>;
  }
  if (!data) {
    return <p className="text-sm text-muted">لا بيانات</p>;
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-2xl font-semibold tabular-nums" dir="ltr">
          {data.balanceCached} <span className="text-base font-normal text-muted">{currencyLabel(data.currency)}</span>
        </div>
        {data.exists ? (
          <StatusBadge tone="positive">محفظة نشطة</StatusBadge>
        ) : (
          <StatusBadge tone="neutral">لا سجل محفظة بعد</StatusBadge>
        )}
      </div>
      <p className="text-xs text-muted">{sub}</p>
    </div>
  );
}

export function FinancePageView() {
  const role = useAuthStore((s) => s.user?.role);
  const token = useAuthStore((s) => s.token);
  const authUserId = useAuthStore((s) => s.user?.id);

  const isSuperAdmin = isSuperAdminRole(role);
  const isCompanyAdmin = isCompanyAdminRole(role);
  const canSeeSupervisor = isSupervisorFinanceRole(role);
  const canSeeStore = canReadStoreWalletUi(role) && !isCompanyAdmin;
  const canSeeCaptain = canReadCaptainWalletUi(role);
  const canSeeCompany = canViewCompanyWalletSection(role);

  const [storeTopupOpen, setStoreTopupOpen] = useState(false);
  const [supervisorTopupOpen, setSupervisorTopupOpen] = useState(false);
  const [companyTopupOpen, setCompanyTopupOpen] = useState(false);
  const [supervisorTransferOpen, setSupervisorTransferOpen] = useState(false);
  const [caCaptainPrepaidOpen, setCaCaptainPrepaidOpen] = useState(false);

  const tabs = useMemo((): FinanceTab[] => {
    if (isCompanyAdmin) {
      const t: FinanceTab[] = [];
      if (canSeeCompany) t.push("company");
      if (canSeeCaptain) t.push("captain");
      return t;
    }
    const t: FinanceTab[] = [];
    if (canSeeSupervisor) t.push("supervisor");
    if (canSeeStore) t.push("store");
    if (canSeeCaptain) t.push("captain");
    if (canSeeCompany) t.push("company");
    return t;
  }, [isCompanyAdmin, canSeeCaptain, canSeeCompany, canSeeStore, canSeeSupervisor]);

  const [tab, setTab] = useState<FinanceTab | null>(null);
  useEffect(() => {
    if (tab == null && tabs.length) {
      setTab(tabs[0]!);
    }
  }, [tab, tabs]);
  useEffect(() => {
    if (tab != null && tabs.length && !tabs.includes(tab)) {
      setTab(tabs[0] ?? null);
    }
  }, [tab, tabs]);

  const activeTab = tab ?? tabs[0] ?? null;

  useEffect(() => {
    if (activeTab !== "supervisor") {
      setSupervisorTransferOpen(false);
    }
  }, [activeTab]);

  const storesList = useStores(1, 100, { enabled: Boolean(token) && canSeeStore });
  const captainsList = useCaptains(
    { page: 1, pageSize: 100 },
    { enabled: Boolean(token) && canSeeCaptain },
  );

  const [storeId, setStoreId] = useState<string | null>(null);
  const [captainId, setCaptainId] = useState<string | null>(null);

  useEffect(() => {
    const items = storesList.data?.items ?? [];
    if (!items.length) return;
    setStoreId((cur) => (cur && items.some((s) => s.id === cur) ? cur : items[0]!.id));
  }, [storesList.data?.items]);

  useEffect(() => {
    const items = captainsList.data?.items ?? [];
    if (!items.length) return;
    setCaptainId((cur) => (cur && items.some((c) => c.id === cur) ? cur : items[0]!.id));
  }, [captainsList.data?.items]);

  const supervisorWallet = useQuery({
    queryKey: queryKeys.finance.supervisorMe(),
    queryFn: () => api.finance.getMySupervisorWallet(),
    enabled: Boolean(token) && activeTab === "supervisor" && canSeeSupervisor,
  });

  const storeWallet = useQuery({
    queryKey: storeId ? queryKeys.finance.storeWallet(storeId) : (["finance", "store-wallet", ""] as const),
    queryFn: () => api.finance.getStoreWallet(storeId!),
    enabled: Boolean(token) && activeTab === "store" && canSeeStore && Boolean(storeId),
  });

  const captainWallet = useQuery({
    queryKey: captainId
      ? queryKeys.finance.captainWallet(captainId)
      : (["finance", "captain-wallet", ""] as const),
    queryFn: () => api.finance.getCaptainWallet(captainId!),
    enabled: Boolean(token) && activeTab === "captain" && canSeeCaptain && Boolean(captainId),
  });

  const companiesForSuperWallet = useCompaniesForSuperAdmin({
    enabled: Boolean(token) && isSuperAdmin && activeTab === "company",
  });
  const [saCompanyId, setSaCompanyId] = useState<string | null>(null);
  useEffect(() => {
    const items = companiesForSuperWallet.data ?? [];
    if (!items.length) return;
    setSaCompanyId((cur) => (cur && items.some((c) => c.id === cur) ? cur : items[0]!.id));
  }, [companiesForSuperWallet.data]);

  const saCompanyName = useMemo(() => {
    return companiesForSuperWallet.data?.find((c) => c.id === saCompanyId)?.name ?? null;
  }, [companiesForSuperWallet.data, saCompanyId]);

  const companyWalletMe = useQuery({
    queryKey: queryKeys.finance.companyWalletMe(),
    queryFn: () => api.finance.getMyCompanyWallet(),
    enabled: Boolean(token) && activeTab === "company" && isCompanyAdmin,
  });

  const companyWalletById = useQuery({
    queryKey: saCompanyId ? queryKeys.finance.companyWalletById(saCompanyId) : (["finance", "company-wallet", ""] as const),
    queryFn: () => api.finance.getCompanyWalletById(saCompanyId!),
    enabled: Boolean(token) && activeTab === "company" && isSuperAdmin && Boolean(saCompanyId),
  });

  const companyWalletQuery = isCompanyAdmin ? companyWalletMe : companyWalletById;

  const mainQuery =
    activeTab === "supervisor"
      ? supervisorWallet
      : activeTab === "store"
        ? storeWallet
        : activeTab === "captain"
          ? captainWallet
          : activeTab === "company"
            ? companyWalletQuery
            : null;

  const balance =
    activeTab === "supervisor"
      ? supervisorWallet.data
      : activeTab === "store"
        ? storeWallet.data
        : activeTab === "captain"
          ? captainWallet.data
          : undefined;
  const walletAccountId = balance?.walletAccountId ?? null;
  const ledgerEnabled = Boolean(walletAccountId) && activeTab !== "company";
  const companyWalletData: CompanyWalletReadDto | undefined =
    activeTab === "company" && (isCompanyAdmin || isSuperAdmin) ? companyWalletQuery.data : undefined;

  const ledger = useFinanceLedgerLoadMore(walletAccountId, {
    enabled: ledgerEnabled && Boolean(activeTab),
  });

  const invalidateCurrent = useCallback(() => {
    if (activeTab === "supervisor") {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.supervisorMe() });
    } else if (activeTab === "store" && storeId) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.storeWallet(storeId) });
    } else if (activeTab === "captain" && captainId) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.captainWallet(captainId) });
    } else if (activeTab === "company" && isCompanyAdmin) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.companyWalletMe() });
    } else if (activeTab === "company" && isSuperAdmin && saCompanyId) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.companyWalletById(saCompanyId) });
    }
    if (walletAccountId) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.ledgerFirstPage(walletAccountId) });
      void queryClient.invalidateQueries({ queryKey: ["finance", "ledger-activity", walletAccountId] });
    }
  }, [activeTab, captainId, isCompanyAdmin, isSuperAdmin, saCompanyId, storeId, walletAccountId]);

  if (!canAccessFinancePage(role)) {
    return <Navigate to="/" replace />;
  }

  if (!activeTab || tabs.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-8 sm:gap-10">
      <PageHeader
        title="المالية"
        divider
        description={
          isSuperAdmin
            ? "عرض أرصدة المحافظ وسجل العمليات. شحن متجر أو مشرف من الأعلى، أو شحن محفظة الشركة من تبويب «محفظة الشركة»."
            : isCompanyAdmin
              ? "عرض رصيد محفظة الشركة (للقراءة فقط) ومحفظة الكابتن وشحن باقة الكابتن عند الحاجة — دون إدارة المتاجر من هنا."
              : "عرض أرصدة المحافظ وسجل العمليات."
        }
        actions={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void invalidateCurrent()}
            disabled={!mainQuery || mainQuery.isFetching}
            aria-busy={mainQuery?.isFetching}
          >
            <RefreshCw className="size-4 opacity-80" />
            تحديث
          </Button>
        }
      />

      {isSuperAdmin ? (
        <Card className="ring-1 ring-primary/10 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">أدوات مدير النظام</CardTitle>
            <CardDescription>شحن محفظة متجر أو شحن أو خصم رصيد المشرف (مشرف فرع/موزع) — POST مع Idempotency-Key.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => setStoreTopupOpen(true)}>
              شحن محفظة متجر
            </Button>
            <Button type="button" variant="secondary" onClick={() => setSupervisorTopupOpen(true)}>
              تعديل الرصيد
            </Button>
          </CardContent>
        </Card>
      ) : null}
      {isCompanyAdmin ? (
        <Card className="ring-1 ring-primary/10 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">أدوات مدير الشركة</CardTitle>
            <CardDescription>
              شحن رصيد باقة كابتن داخل شركتك فقط. يُطلب مبلغ وسبب، ويُولَّد idempotency تلقائياً. لا يوجد شحن لمحفظة الشركة من
              هنا.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => setCaCaptainPrepaidOpen(true)}>
              شحن رصيد باقة كابتن
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {isSuperAdmin ? (
        <SuperAdminStoreTopupModal
          open={storeTopupOpen}
          onClose={() => setStoreTopupOpen(false)}
          defaultStoreId={activeTab === "store" ? storeId : null}
        />
      ) : null}
      {isSuperAdmin ? (
        <SuperAdminSupervisorTopupModal
          open={supervisorTopupOpen}
          onClose={() => setSupervisorTopupOpen(false)}
          defaultUserId={null}
        />
      ) : null}
      {isSuperAdmin ? (
        <SuperAdminCompanyTopupModal
          open={companyTopupOpen}
          onClose={() => setCompanyTopupOpen(false)}
          companyId={saCompanyId}
          companyName={saCompanyName}
        />
      ) : null}
      {isCompanyAdmin ? (
        <CompanyAdminCaptainPrepaidModal
          open={caCaptainPrepaidOpen}
          onClose={() => setCaCaptainPrepaidOpen(false)}
          defaultCaptainId={activeTab === "captain" ? captainId : null}
        />
      ) : null}

      <div
        className="flex flex-wrap gap-2 rounded-xl border border-card-border bg-muted/20 p-2 shadow-inner"
        role="tablist"
        aria-label="نوع المحفظة"
      >
        {canSeeSupervisor ? (
          <Button
            type="button"
            size="sm"
            variant={activeTab === "supervisor" ? "default" : "secondary"}
            onClick={() => setTab("supervisor")}
            aria-pressed={activeTab === "supervisor"}
          >
            محفظة المشرف
          </Button>
        ) : null}
        {canSeeStore ? (
          <Button
            type="button"
            size="sm"
            variant={activeTab === "store" ? "default" : "secondary"}
            onClick={() => setTab("store")}
            aria-pressed={activeTab === "store"}
          >
            محفظة المتجر
          </Button>
        ) : null}
        {canSeeCaptain ? (
          <Button
            type="button"
            size="sm"
            variant={activeTab === "captain" ? "default" : "secondary"}
            onClick={() => setTab("captain")}
            aria-pressed={activeTab === "captain"}
          >
            محفظة الكابتن
          </Button>
        ) : null}
        {canSeeCompany ? (
          <Button
            type="button"
            size="sm"
            variant={activeTab === "company" ? "default" : "secondary"}
            onClick={() => setTab("company")}
            aria-pressed={activeTab === "company"}
          >
            محفظة الشركة
          </Button>
        ) : null}
      </div>

      <Card className="shadow-sm ring-1 ring-card-border/80">
        <CardHeader>
          <CardTitle className="text-base">الرصيد</CardTitle>
          <CardDescription>
            {activeTab === "supervisor"
              ? "حساب المشرف المرتبط بحسابك في الشركة."
              : activeTab === "store"
                ? "رصيد المتجر المختار."
                : activeTab === "captain"
                  ? "رصيد الكابتن المختار."
                  : "رصيد محفظة الشركة (طلبات/تشغيل) — للقراءة فقط."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeTab === "company" && isSuperAdmin && canSeeCompany ? (
            <div className="flex max-w-2xl flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <label className="flex min-w-[12rem] max-w-md flex-1 flex-col gap-1 text-sm">
                <span className="text-muted">الشركة (مدير النظام)</span>
                <select
                  className={FORM_CONTROL_CLASS}
                  value={saCompanyId ?? ""}
                  onChange={(e) => setSaCompanyId(e.target.value || null)}
                  disabled={companiesForSuperWallet.isLoading || !(companiesForSuperWallet.data?.length)}
                >
                  {(companiesForSuperWallet.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              {saCompanyId ? (
                <Button type="button" onClick={() => setCompanyTopupOpen(true)}>
                  شحن محفظة الشركة
                </Button>
              ) : null}
            </div>
          ) : null}

          {activeTab === "company" && isCompanyAdmin ? (
            <p className="text-sm text-muted">
              تُعرض محفظة شركتك المرتبطة بحسابك فقط. لا يمكن اختيار شركة أخرى من هنا.
            </p>
          ) : null}

          {activeTab === "store" && canSeeStore ? (
            <div className="flex max-w-2xl flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm">
                <span className="text-muted">المتجر</span>
                <select
                  className={FORM_CONTROL_CLASS}
                  value={storeId ?? ""}
                  onChange={(e) => setStoreId(e.target.value || null)}
                  disabled={storesList.isLoading || !storesList.data?.items.length}
                >
                  {(storesList.data?.items ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {s.area}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          {activeTab === "captain" && canSeeCaptain ? (
            <div className="flex max-w-2xl flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm">
                <span className="text-muted">الكابتن</span>
                <select
                  className={FORM_CONTROL_CLASS}
                  value={captainId ?? ""}
                  onChange={(e) => setCaptainId(e.target.value || null)}
                  disabled={captainsList.isLoading || !captainsList.data?.items.length}
                >
                  {(captainsList.data?.items ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.user.fullName} — {c.area}
                    </option>
                  ))}
                </select>
              </label>
              {isCompanyAdmin ? (
                <Button type="button" size="sm" onClick={() => setCaCaptainPrepaidOpen(true)}>
                  شحن باقة الكابتن
                </Button>
              ) : null}
            </div>
          ) : null}

          {activeTab === "company" ? (
            <div className="space-y-3">
              {companyWalletQuery.isLoading ? (
                <LoadingBlock message="جارٍ تحميل رصيد الشركة…" compact />
              ) : companyWalletQuery.isError ? (
                <div className="space-y-2">
                  {companyWalletQuery.error instanceof ApiError &&
                  (companyWalletQuery.error.code === "TENANT_SCOPE_REQUIRED" ||
                    companyWalletQuery.error.code === "FORBIDDEN") ? (
                    <InlineAlert variant="error">
                      {companyWalletQuery.error.code === "TENANT_SCOPE_REQUIRED"
                        ? "لا يتوفر نطاق شركة على حسابك (TENANT_SCOPE_REQUIRED). تواصل مع الإدارة."
                        : "غير مسموح بعرض رصيد المحفظة."}
                    </InlineAlert>
                  ) : (
                    <InlineAlert variant="error">{(companyWalletQuery.error as Error).message}</InlineAlert>
                  )}
                </div>
              ) : companyWalletData ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="text-2xl font-semibold tabular-nums" dir="ltr">
                      {companyWalletData.balance}{" "}
                      <span className="text-base font-normal text-muted">
                        {currencyLabel(companyWalletData.currency)}
                      </span>
                    </div>
                    <StatusBadge tone="neutral">قراءة فقط</StatusBadge>
                  </div>
                  <p className="text-xs text-muted">
                    آخر تحديث للسجل:{" "}
                    <span className="tabular-nums" dir="ltr">
                      {new Date(companyWalletData.updatedAt).toLocaleString()}
                    </span>
                  </p>
                  <p className="text-xs text-muted">معرّف المحفظة: {companyWalletData.walletId}</p>
                  {companyWalletData.recentLedger.length > 0 ? (
                    <div className="mt-4 space-y-2 border-t border-card-border pt-4">
                      <p className="text-sm font-medium">آخر الحركات (حتى 5)</p>
                      <TableShell>
                        <table className="w-full min-w-[520px] border-collapse text-sm">
                          <thead>
                            <tr className="border-b border-card-border bg-muted/30 text-start text-muted">
                              <th className="px-3 py-2 font-medium">النوع</th>
                              <th className="px-3 py-2 font-medium">المبلغ</th>
                              <th className="px-3 py-2 font-medium">التاريخ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {companyWalletData.recentLedger.map((row) => (
                              <tr key={row.id} className="border-b border-card-border/80">
                                <td className="px-3 py-2">{companyLedgerTypeLabel(row.entryType)}</td>
                                <td className="px-3 py-2 tabular-nums" dir="ltr">
                                  {row.amount} {row.currency}
                                </td>
                                <td className="px-3 py-2 tabular-nums text-muted" dir="ltr">
                                  {new Date(row.createdAt).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </TableShell>
                    </div>
                  ) : (
                    <p className="text-xs text-muted">لا حركات مسجّلة بعد في آخر الدفعة المعروضة.</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted">لا بيانات</p>
              )}
            </div>
          ) : (
            <BalanceCard
              sub={
                balance
                  ? balance.exists
                    ? "يظهر الرصيد المخزَّن كما في الخادم."
                    : "لم تُنشأ محفظة بعد — يُعرض صفر حتى أول حركة."
                  : "—"
              }
              data={balance}
              isLoading={Boolean(mainQuery?.isLoading)}
              error={mainQuery?.isError ? (mainQuery.error as Error) : null}
            />
          )}
        </CardContent>
      </Card>

      {activeTab === "supervisor" && canSeeSupervisor && authUserId ? (
        <Card className="shadow-sm ring-1 ring-card-border/80">
          <CardHeader>
            <CardTitle className="text-base">تحويل للكابتن</CardTitle>
            <CardDescription>
              تحويل من محفظة مشرفك إلى محفظة كابتن تشرف عليه. متاح لمشرف الفرع والموزع فقط.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" onClick={() => setSupervisorTransferOpen(true)}>
              تحويل لكابتن
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "supervisor" && canSeeSupervisor && authUserId ? (
        <SupervisorCaptainTransferModal
          open={supervisorTransferOpen}
          onClose={() => setSupervisorTransferOpen(false)}
          actorUserId={authUserId}
          defaultCaptainId={null}
        />
      ) : null}

      {activeTab === "company" ? (
        <Card className="shadow-sm ring-1 ring-card-border/80">
          <CardHeader>
            <CardTitle className="text-base">سجل العمليات</CardTitle>
            <CardDescription>
              لمحفظة الشركة تُعرض أحدث الحركات مع بطاقة الرصيد أعلاه. التصفح الكامل يتطلب دعمًا إضافيًا من الخادم لاحقًا.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <Card className="shadow-sm ring-1 ring-card-border/80">
            <CardHeader>
              <CardTitle className="text-base">سجل العمليات</CardTitle>
              <CardDescription>
                {ledgerEnabled
                  ? "الأحدث أولاً. التحميل الإضافي يجلب الدفعة التالية."
                  : "لا يوجد أرقام محفظة بعد — لا يُطلب سجل الحركات."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!ledgerEnabled ? (
                <EmptyState
                  title="لا يوجد سجل محفظة"
                  description="بعد إنشاء المحفظة وظهور أرقامها يمكن عرض الحركات هنا."
                />
              ) : (
                <FinanceLedgerTable
                  items={ledger.items}
                  isLoading={ledger.isLoading}
                  isError={ledger.isError}
                  errorMessage={(ledger.error as Error)?.message ?? "تعذّر التحميل"}
                  onLoadMore={() => void ledger.loadMore()}
                  canLoadMore={ledger.canLoadMore}
                  isFetchingFirst={ledger.isFetchingFirst}
                  emptyMessage="لا حركات بعد."
                />
              )}
            </CardContent>
          </Card>

          <LedgerActivityReportSection
            walletAccountId={ledgerEnabled ? walletAccountId : null}
            activeTab={activeTab as "supervisor" | "store" | "captain"}
          />
        </>
      )}
    </div>
  );
}
