import { useEffect, useState } from "react";
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
    const t = localDatetimeToUtcIso(draftToLocal);
    if (!f || !t) {
      setClientError("التاريخ/الوقت غير صالح.");
      return;
    }
    if (!isValidLedgerActivityRange(f, t)) {
      setClientError("يجب أن يكون «من» قبل «إلى»، ولا تزيد الفترة عن 90 يوماً.");
      return;
    }
    setFromUtc(f);
    setToUtc(t);
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
              : "تعذّر التصدير";
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
        : "تعذّر التحميل";

  if (!ledgerEnabled) {
    return (
      <Card className="shadow-sm ring-1 ring-card-border/80">
        <CardHeader>
          <CardTitle className="text-base">تقرير حركات المحفظة (بالفترة)</CardTitle>
          <CardDescription>
            حركات الدفتر ضمن فترة زمنية. يُرسل النطاق إلى الخادم كـ UTC (ISO-8601).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="لا يوجد رقم محفظة"
            description="أنشئ أول حركة أو انتظر إنشاء المحفظة ليتاح التقرير."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm ring-1 ring-card-border/80">
      <CardHeader>
        <CardTitle className="text-base">تقرير حركات المحفظة (بالفترة)</CardTitle>
        <CardDescription>
          حركات الدفتر ضمن النطاق على الخادم (UTC). الافتراضي: آخر 7 أيام. عرض الوقت في الحقول حسب وضع
          التصفح المحلي.
        </CardDescription>
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
            <span className="text-muted">من (محلي)</span>
            <input
              type="datetime-local"
              className={FORM_CONTROL_CLASS}
              value={draftFromLocal}
              onChange={(e) => setDraftFromLocal(e.target.value)}
            />
          </label>
          <label className="flex min-w-[12rem] flex-col gap-1 text-sm">
            <span className="text-muted">إلى (محلي)</span>
            <input
              type="datetime-local"
              className={FORM_CONTROL_CLASS}
              value={draftToLocal}
              onChange={(e) => setDraftToLocal(e.target.value)}
            />
          </label>
          <Button type="submit" size="sm">
            تطبيق
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!walletAccountId || !token || !rangeOk || exporting}
            onClick={onExportCsv}
            aria-busy={exporting}
          >
            {exporting ? "جارٍ التصدير…" : "تنزيل CSV"}
          </Button>
        </form>

        {clientError ? <InlineAlert variant="warning">{clientError}</InlineAlert> : null}
        {exportError ? <InlineAlert variant="error">{exportError}</InlineAlert> : null}

        {typeof report.totalInRange === "number" ? (
          <p className="text-xs text-muted" dir="ltr">
            في النطاق: {report.totalInRange} حركة (معروض: {report.items.length})
            {report.reportRange
              ? ` — UTC: ${report.reportRange.from} … ${report.reportRange.to}`
              : null}
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
          emptyMessage="لا حركات في هذه الفترة."
        />
      </CardContent>
    </Card>
  );
}
