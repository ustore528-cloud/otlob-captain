import type { UseQueryResult } from "@tanstack/react-query";
import type { CaptainStats } from "@/types/api";

type Props = {
  query: UseQueryResult<CaptainStats, Error>;
};

export function CaptainStatsModalBody({ query }: Props) {
  if (query.isLoading) return <p className="text-sm text-muted">جارٍ التحميل…</p>;
  if (query.isError) return <p className="text-sm text-red-600">{(query.error as Error).message}</p>;
  if (!query.data) return null;

  return (
    <div className="grid gap-4 text-sm">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-card-border bg-background/50 p-3">
          <div className="text-xs text-muted">طلبات مسلّمة</div>
          <div className="text-xl font-semibold tabular-nums">{query.data.ordersDelivered}</div>
        </div>
        <div className="rounded-xl border border-card-border bg-background/50 p-3">
          <div className="text-xs text-muted">طلبات نشطة</div>
          <div className="text-xl font-semibold tabular-nums">{query.data.activeOrders}</div>
        </div>
      </div>
      <div>
        <div className="text-xs text-muted">آخر موقع مسجّل</div>
        {query.data.lastLocation ? (
          <pre
            className="mt-1 max-h-40 overflow-auto rounded-lg border border-card-border bg-background/50 p-3 font-mono text-xs leading-relaxed"
            dir="ltr"
          >
            {JSON.stringify(query.data.lastLocation, null, 2)}
          </pre>
        ) : (
          <p className="mt-1 text-muted">لا يوجد موقع مسجّل.</p>
        )}
      </div>
    </div>
  );
}
