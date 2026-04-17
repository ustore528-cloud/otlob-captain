import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";

/**
 * إبطال ذاكرة الواجهات المرتبطة بالطلبات والتوزيع بعد طلبات REST
 * (يُكمّل تحديثات Socket.IO في `useDashboardSocketInvalidate`).
 */
export async function invalidateOrderDistributionDomain(qc: QueryClient): Promise<void> {
  await Promise.all([
    qc.invalidateQueries({ queryKey: queryKeys.orders.root }),
    qc.invalidateQueries({ queryKey: queryKeys.dashboard.root }),
    qc.invalidateQueries({ queryKey: queryKeys.tracking.root }),
    qc.invalidateQueries({ queryKey: queryKeys.captains.root }),
  ]);
}
