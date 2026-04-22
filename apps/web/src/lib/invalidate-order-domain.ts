import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";

/**
 * إبطال ذاكرة الواجهات المرتبطة بالطلبات والتوزيع بعد طلبات REST
 * (يُكمّل تحديثات Socket.IO في `useDashboardSocketInvalidate`).
 *
 * يُضيّق النطاق عن `dashboard.root` و`tracking.root`: لا حاجة لإعادة جلب إعدادات اللوحة بعد كل عملية طلب،
 * ولا لـ latest-locations عندما يكفي تحديث خريطة active-map للتوزيع.
 */
export async function invalidateOrderDistributionDomain(qc: QueryClient): Promise<void> {
  await Promise.all([
    qc.invalidateQueries({ queryKey: queryKeys.orders.root }),
    qc.invalidateQueries({ queryKey: queryKeys.dashboard.stats() }),
    qc.invalidateQueries({ queryKey: queryKeys.tracking.activeMap() }),
    qc.invalidateQueries({ queryKey: queryKeys.captains.root }),
  ]);
}
