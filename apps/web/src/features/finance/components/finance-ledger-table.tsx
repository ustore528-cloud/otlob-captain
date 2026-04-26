import type { FinanceLedgerEntryReadDto, FinanceLedgerEntryType } from "@/types/api";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { LoadingBlock } from "@/components/ui/loading-block";
import { TableShell } from "@/components/ui/table-shell";

const SAFE_METADATA_KEYS_ORDER = [
  "orderNumber",
  "leg",
  "kind",
  "transferIdempotencyKey",
  "captainId",
  "transferGroup",
] as const;

function entryTypeLabel(t: FinanceLedgerEntryType): string {
  const map: Record<FinanceLedgerEntryType, string> = {
    SUPER_ADMIN_TOP_UP: "شحن (مدير)",
    WALLET_TRANSFER: "تحويل",
    ORDER_DELIVERED_STORE_DEBIT: "خصم طلب (متجر)",
    ORDER_DELIVERED_CAPTAIN_DEDUCTION: "خصم تسليم (كابتن)",
    ADJUSTMENT: "تسوية",
    CAPTAIN_PREPAID_CHARGE: "شحن باقة كابتن",
    CAPTAIN_PREPAID_ADJUSTMENT: "تسوية باقة كابتن",
  };
  return map[t] ?? t;
}

function formatMetadata(meta: Record<string, string> | null): string {
  if (!meta) return "—";
  const parts: string[] = [];
  for (const k of SAFE_METADATA_KEYS_ORDER) {
    if (k in meta && meta[k] !== undefined && String(meta[k]).length) {
      parts.push(`${k}=${meta[k]}`);
    }
  }
  return parts.length ? parts.join(" · ") : "—";
}

type Props = {
  items: FinanceLedgerEntryReadDto[];
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
  onLoadMore: () => void;
  canLoadMore: boolean;
  isFetchingFirst: boolean;
  emptyMessage: string;
};

function currencyLabel(currency: string): string {
  return currency === "ILS" ? "₪ ILS" : currency;
}

export function FinanceLedgerTable({
  items,
  isLoading,
  isError,
  errorMessage,
  onLoadMore,
  canLoadMore,
  isFetchingFirst,
  emptyMessage,
}: Props) {
  if (isError) {
    return <InlineAlert variant="error">{errorMessage}</InlineAlert>;
  }

  if (isLoading) {
    return <LoadingBlock message="جارٍ تحميل سجل العمليات…" />;
  }

  if (items.length === 0) {
    return <EmptyState title={emptyMessage} />;
  }

  return (
    <div className="space-y-4">
      <TableShell>
        <table className="w-full min-w-[880px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="bg-muted/30 text-muted">
              <th className="border-b border-card-border px-3 py-2.5 text-right text-xs font-medium">الوقت</th>
              <th className="border-b border-card-border px-3 py-2.5 text-right text-xs font-medium">النوع</th>
              <th className="border-b border-card-border px-3 py-2.5 text-left text-xs font-medium">المبلغ</th>
              <th className="border-b border-card-border px-3 py-2.5 text-right text-xs font-medium">الطلب</th>
              <th className="border-b border-card-border px-3 py-2.5 text-right text-xs font-medium">بيانات إضافية</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className="transition hover:bg-accent/50">
                <td className="border-b border-card-border px-3 py-2.5 align-top text-xs" dir="ltr">
                  {new Date(row.createdAt).toLocaleString("ar-SA")}
                </td>
                <td className="border-b border-card-border px-3 py-2.5 align-top">
                  <div className="font-medium">{entryTypeLabel(row.entryType)}</div>
                  <div className="text-[10px] font-mono text-muted" dir="ltr">
                    {row.entryType}
                  </div>
                </td>
                <td className="border-b border-card-border px-3 py-2.5 align-top font-mono" dir="ltr">
                  {row.amount} {currencyLabel(row.currency)}
                </td>
                <td className="border-b border-card-border px-3 py-2.5 align-top text-xs" dir="ltr">
                  {row.orderId ? (
                    <span className="font-mono" title="معرّف الطلب في النظام">
                      {row.orderId}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td
                  className="max-w-[240px] border-b border-card-border px-3 py-2.5 align-top break-words text-xs text-muted"
                  dir="ltr"
                >
                  {formatMetadata(row.metadata)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>
      {canLoadMore ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onLoadMore()}
          disabled={isFetchingFirst}
        >
          تحميل المزيد
        </Button>
      ) : null}
    </div>
  );
}
