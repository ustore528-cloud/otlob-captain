import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
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
import { captainVehicleLabel } from "@/features/captains/lib/captain-vehicle-options";
import { CompanyAdminCaptainPrepaidModal } from "@/features/finance/components/company-admin-captain-prepaid-modal";
import { api } from "@/lib/api/singleton";
import { queryKeys } from "@/lib/api/query-keys";
import { isCompanyAdminRole } from "@/lib/rbac-roles";
import { useAuthStore } from "@/stores/auth-store";
import { toastApiError, toastSuccess } from "@/lib/toast";
import type { CaptainListItem } from "@/types/api";
import { captainAreaDisplay, captainUserNameDisplay, supervisorNameDisplay } from "@/i18n/localize-entity-labels";
import type { FinanceLedgerEntryType } from "@/types/api";
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
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
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
      toastSuccess(t("captains.roster.chargeSuccess"));
      await qc.invalidateQueries({ queryKey: queryKeys.captains.root });
    },
    onError: (err) => toastApiError(err, t("captains.roster.chargeError")),
  });
  const adjustment = useMutation({
    mutationFn: ({ id, amount, note }: { id: string; amount: number; note: string }) =>
      api.captains.prepaidAdjustment(id, { amount, note }),
    onSuccess: async () => {
      toastSuccess(t("captains.roster.adjustSuccess"));
      await qc.invalidateQueries({ queryKey: queryKeys.captains.root });
    },
    onError: (err) => toastApiError(err, t("captains.roster.adjustError")),
  });

  function askAmount(label: string) {
    const raw = window.prompt(label);
    if (raw == null) return null;
    const amount = Number(raw.replace(",", "."));
    if (!Number.isFinite(amount)) {
      window.alert(t("captains.roster.enterValidAmount"));
      return null;
    }
    return amount;
  }

  function chargeBalance(c: CaptainListItem) {
    if (isCompanyAdmin) {
      setCaPrepaidTarget(c);
      return;
    }
    const amount = askAmount(t("captains.roster.chargePrompt", { name: captainUserNameDisplay(c, lang) }));
    if (amount == null || amount <= 0) return;
    const note = window.prompt(t("captains.roster.optionalNote")) ?? undefined;
    charge.mutate({ id: c.id, amount, note });
  }

  async function showLedger(c: CaptainListItem) {
    try {
      const ledger = await api.captains.prepaidTransactions(c.id, { page: 1, pageSize: 8 });
      const lines = ledger.items.map((x) => {
        const typeKey = `finance.transactionTypes.${x.type}` as const;
        const typeUi = t(typeKey, { defaultValue: x.type as FinanceLedgerEntryType });
        return `${new Date(x.createdAt).toLocaleString("en-GB")} | ${typeUi} | ${formatIls(x.amount)} (${ILS_LABEL}) | ${t("captains.roster.afterTransaction")} ${formatIls(x.balanceAfter)}`;
      });
      window.alert(lines.length ? lines.join("\n") : t("captains.roster.noLedgerTransactions"));
    } catch (err) {
      toastApiError(err, t("captains.roster.ledgerLoadError"));
    }
  }

  function confirmDelete(c: CaptainListItem) {
    const ok = window.confirm(t("captains.roster.deleteConfirm", { name: captainUserNameDisplay(c, lang) }));
    if (!ok) return;
    del.mutate(c.id);
  }

  return (
    <Card className="border-card-border shadow-sm ring-1 ring-card-border/70">
      <CardHeader className="border-b border-card-border/70 pb-5">
        <CardTitle className="text-base">{t("captains.roster.listTitle")}</CardTitle>
        <CardDescription>{captains.data ? t("captains.roster.count", { count: captains.data.total }) : t("common.none")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 pt-4">
        {captains.isLoading ? (
          <LoadingBlock message={t("captains.roster.loading")} compact />
        ) : captains.isError ? (
          <InlineAlert variant="error">{(captains.error as Error).message}</InlineAlert>
        ) : (captains.data?.items ?? []).length === 0 ? (
          <EmptyState title={t("captains.roster.emptyTitle")} description={t("captains.roster.emptyDescription")} className="py-10" />
        ) : (
          (captains.data?.items ?? []).map((c: CaptainListItem) => (
            <div
              key={c.id}
              className="flex flex-col gap-3 rounded-xl border border-card-border bg-card p-4 shadow-sm ring-1 ring-card-border/50 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{captainUserNameDisplay(c, lang)}</span>
                  <StatusBadge tone={c.isActive && c.user.isActive ? "positive" : "neutral"}>
                    {c.isActive && c.user.isActive ? t("common.status.active") : t("common.status.inactive")}
                  </StatusBadge>
                  <StatusBadge tone="info">{availabilityAr(c.availabilityStatus)}</StatusBadge>
                </div>
                <div className="mt-1 text-sm text-muted" dir="ltr">
                  {c.user.phone}
                </div>
                <div className="mt-2 text-xs text-muted">
                  {captainVehicleLabel(c.vehicleType, t)} — {captainAreaDisplay(c, lang)}
                </div>
                <div className="mt-2 text-xs text-muted">
                  {t("captains.roster.supervisorLabel")}:{" "}
                  {c.supervisorUser ? (
                    <>
                      <span className="text-foreground">{supervisorNameDisplay(c.supervisorUser, lang)}</span>
                      <span className="mx-1 text-muted">·</span>
                      <span dir="ltr">{c.supervisorUser.phone}</span>
                    </>
                  ) : (
                    <span>{t("stores.page.noSupervisor")}</span>
                  )}
                </div>
                <div className="mt-3 grid gap-2 rounded-lg border border-card-border bg-background/70 p-3 text-xs sm:grid-cols-3">
                  <StatTile label={t("captains.roster.remainingBalance", { currency: ILS_LABEL })} value={Number(c.prepaidBalance ?? 0)} />
                  <div className="rounded-lg border border-card-border bg-muted/15 p-3 text-sm shadow-sm">
                    <div className="text-muted">{t("captains.roster.commissionRate")}</div>
                    <div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                      {c.commissionPercent ?? t("captains.roster.defaultCommission")}%
                    </div>
                  </div>
                  <StatTile label={t("captains.roster.totalDeducted", { currency: ILS_LABEL })} value={Number(c.totalDeducted ?? 0)} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {canManage ? (
                  <Button type="button" variant="default" size="sm" disabled={charge.isPending} onClick={() => chargeBalance(c)}>
                    <CreditCard className="size-4" />
                    {t("captains.roster.chargeBalance")}
                  </Button>
                ) : null}
                {canManage ? (
                  <Button type="button" variant="secondary" size="sm" disabled={adjustment.isPending} onClick={() => setAdjustTarget(c)}>
                    <SlidersHorizontal className="size-4" />
                    {t("captains.roster.balanceAdjust")}
                  </Button>
                ) : null}
                <Button type="button" variant="ghost" size="sm" onClick={() => void showLedger(c)}>
                  <ListChecks className="size-4" />
                  {t("captains.roster.ledger")}
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => onOpenReport(c)}>
                  <BarChart3 className="size-4" />
                  {t("captains.roster.report")}
                </Button>
                {canManage ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => onOpenEdit(c)}>
                    <Pencil className="size-4" />
                    {t("common.edit")}
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
                    {t("common.delete")}
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
                    {c.isActive ? t("common.disable") : t("common.enable")}
                  </Button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </CardContent>
      <CaptainBalanceAdjustmentModal
        open={Boolean(adjustTarget)}
        captainLabel={adjustTarget ? captainUserNameDisplay(adjustTarget, lang) : ""}
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
