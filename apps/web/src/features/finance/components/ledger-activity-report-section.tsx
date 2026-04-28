import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FORM_CONTROL_CLASS } from "@/components/ui/form-field-classes";
import { InlineAlert } from "@/components/ui/inline-alert";
import { FinanceLedgerTable } from "@/features/finance/components/finance-ledger-table";
import { runLedgerActivityCsvExport } from "@/features/finance/utils/ledger-activity-csv-export";
import {
  defaultLedgerActivityRangeUtc,
  isValidLedgerActivityRange,
  useLedgerActivityReport,
} from "@/hooks/finance/use-ledger-activity-report";
import { ApiError } from "@/lib/api/http";
import { useAuthStore } from "@/stores/auth-store";

type FinanceTab = "supervisor" | "store" | "captain";

function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
}

function fromUtcIsoToDatetimeLocalValue(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return toDatetimeLocalValue(new Date(t));
}

function localDatetimeToUtcIso(value: string): string {
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) {
    return "";
  }
  return new Date(t).toISOString();
}

type Props = {
  walletAccountId: string | null;
  activeTab: FinanceTab;
};

export function LedgerActivityReportSection({ walletAccountId, activeTab }: Props) {
  const { t } = useTranslation();
  const token = useAuthStore((s) => s.token);
  const scopeKey = `${activeTab}-${walletAccountId ?? "none"}`;

  const [fromUtc, setFromUtc] = useState(() => defaultLedgerActivityRangeUtc().from);
  const [toUtc, setToUtc] = useState(() => defaultLedgerActivityRangeUtc().to);
  const [draftFromLocal, setDraftFromLocal] = useState(() =>
    fromUtcIsoToDatetimeLocalValue(defaultLedgerActivityRangeUtc().from),
  );
  const [draftToLocal, setDraftToLocal] = useState(() =>
    fromUtcIsoToDatetimeLocalValue(defaultLedgerActivityRangeUtc().to),
  );
  const [clientError, setClientError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    const d = defaultLedgerActivityRangeUtc();
    setFromUtc(d.from);
    setToUtc(d.to);
    setDraftFromLocal(fromUtcIsoToDatetimeLocalValue(d.from));
    setDraftToLocal(fromUtcIsoToDatetimeLocalValue(d.to));
    setClientError(null);
    setExportError(null);
  }, [scopeKey]);

  const report = useLedgerActivityReport(walletAccountId, fromUtc, toUtc, {
    enabled: Boolean(walletAccountId),
    scopeKey,
  });

  const apply = () => {
    setClientError(null);
    const f = localDatetimeToUtcIso(draftFromLocal);
    const to = localDatetimeToUtcIso(draftToLocal);
    if (!f || !to) {
      setClientError(t("finance.ledgerReport.errors.invalidDate"));
      return;
    }
    if (!isValidLedgerActivityRange(f, to)) {
      setClientError(t("finance.ledgerReport.errors.order"));
      return;
    }
    setFromUtc(f);
    setToUtc(to);
  };

  const ledgerEnabled = Boolean(walletAccountId);
  const rangeOk = isValidLedgerActivityRange(fromUtc, toUtc);

  const onExportCsv = () => {
    if (!token || !walletAccountId || !rangeOk) return;
    setExportError(null);
    setExporting(true);
    void (async () => {
      try {
        await runLedgerActivityCsvExport(token, walletAccountId, fromUtc, toUtc);
      } catch (e) {
        const msg =
          e instanceof ApiError
            ? e.message
            : e instanceof Error
              ? e.message
              : t("finance.ledgerReport.exportError");
        setExportError(msg);
      } finally {
        setExporting(false);
      }
    })();
  };

  const errMsg =
    report.isError && report.error instanceof ApiError
      ? report.error.message
      : report.isError
        ? (report.error as Error).message
        : t("finance.ledgerReport.loadError");

  const utcSuffix =
    report.reportRange != null ? ` — UTC: ${report.reportRange.from} … ${report.reportRange.to}` : "";

  if (!ledgerEnabled) {
    return (
      <Card className="shadow-sm ring-1 ring-card-border/80">
        <CardHeader>
          <CardTitle className="text-base">{t("finance.ledgerReport.title")}</CardTitle>
          <CardDescription>{t("finance.ledgerReport.descriptionServerUtc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState title={t("finance.ledgerReport.titleNoWallet")} description={t("finance.ledgerReport.descriptionNoWallet")} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm ring-1 ring-card-border/80">
      <CardHeader>
        <CardTitle className="text-base">{t("finance.ledgerReport.titleAlt")}</CardTitle>
        <CardDescription>{t("finance.ledgerReport.descriptionAlt")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            apply();
          }}
        >
          <label className="flex min-w-[12rem] flex-col gap-1 text-sm">
            <span className="text-muted">{t("finance.ledgerReport.fromLocal")}</span>
            <input
              type="datetime-local"
              className={FORM_CONTROL_CLASS}
              value={draftFromLocal}
              onChange={(e) => setDraftFromLocal(e.target.value)}
            />
          </label>
          <label className="flex min-w-[12rem] flex-col gap-1 text-sm">
            <span className="text-muted">{t("finance.ledgerReport.toLocal")}</span>
            <input
              type="datetime-local"
              className={FORM_CONTROL_CLASS}
              value={draftToLocal}
              onChange={(e) => setDraftToLocal(e.target.value)}
            />
          </label>
          <Button type="submit" size="sm">
            {t("finance.ledgerReport.apply")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!walletAccountId || !token || !rangeOk || exporting}
            onClick={onExportCsv}
            aria-busy={exporting}
          >
            {exporting ? t("finance.ledgerReport.exporting") : t("finance.ledgerReport.exportCsv")}
          </Button>
        </form>

        {clientError ? <InlineAlert variant="warning">{clientError}</InlineAlert> : null}
        {exportError ? <InlineAlert variant="error">{exportError}</InlineAlert> : null}

        {typeof report.totalInRange === "number" ? (
          <p className="text-xs text-muted" dir="ltr">
            {t("finance.ledgerReport.inRangeDetail", {
              total: report.totalInRange,
              shown: report.items.length,
              utcSuffix,
            })}
          </p>
        ) : null}

        <FinanceLedgerTable
          items={report.items}
          isLoading={report.isLoading}
          isError={!clientError && report.isError}
          errorMessage={errMsg}
          onLoadMore={() => void report.loadMore()}
          canLoadMore={report.canLoadMore}
          isFetchingFirst={report.isFetchingFirst}
          emptyMessage={t("finance.ledgerReport.emptyRange")}
        />
      </CardContent>
    </Card>
  );
}
