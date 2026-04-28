import type { UseQueryResult } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { CaptainStats } from "@/types/api";

type Props = {
  query: UseQueryResult<CaptainStats, Error>;
};

export function CaptainStatsModalBody({ query }: Props) {
  const { t } = useTranslation();
  if (query.isLoading) return <p className="text-sm text-muted">{t("common.loading")}</p>;
  if (query.isError) return <p className="text-sm text-red-600">{(query.error as Error).message}</p>;
  if (!query.data) return null;

  return (
    <div className="grid gap-4 text-sm">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-card-border bg-background/50 p-3">
          <div className="text-xs text-muted">{t("captains.stats.deliveredOrders")}</div>
          <div className="text-xl font-semibold tabular-nums">{query.data.ordersDelivered}</div>
        </div>
        <div className="rounded-xl border border-card-border bg-background/50 p-3">
          <div className="text-xs text-muted">{t("captains.stats.activeOrders")}</div>
          <div className="text-xl font-semibold tabular-nums">{query.data.activeOrders}</div>
        </div>
      </div>
      <div>
        <div className="text-xs text-muted">{t("captains.stats.lastLocation")}</div>
        {query.data.lastLocation ? (
          <pre
            className="mt-1 max-h-40 overflow-auto rounded-lg border border-card-border bg-background/50 p-3 font-mono text-xs leading-relaxed"
            dir="ltr"
          >
            {JSON.stringify(query.data.lastLocation, null, 2)}
          </pre>
        ) : (
          <p className="mt-1 text-muted">{t("captains.stats.noLocation")}</p>
        )}
      </div>
    </div>
  );
}
