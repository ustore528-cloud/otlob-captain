import { apiFetch, paths } from "@/lib/api/http";
import type { DeliveredCommissionReportPage, OrdersHistoryReportPage, ReconciliationSummaryDto } from "@/types/api";

export function getReconciliationSummary(
  token: string,
  params: { from: string; to: string },
): Promise<ReconciliationSummaryDto> {
  const p = new URLSearchParams();
  p.set("from", params.from);
  p.set("to", params.to);
  return apiFetch<ReconciliationSummaryDto>(`${paths.reports.reconciliationSummary}?${p.toString()}`, {
    token,
  });
}

export function getDeliveredCommissionsPage(
  token: string,
  params: { from: string; to: string; page: number; pageSize: number },
): Promise<DeliveredCommissionReportPage> {
  const p = new URLSearchParams();
  p.set("from", params.from);
  p.set("to", params.to);
  p.set("page", String(params.page));
  p.set("pageSize", String(params.pageSize));
  return apiFetch<DeliveredCommissionReportPage>(`${paths.reports.deliveredCommissions}?${p.toString()}`, {
    token,
  });
}

export function getOrdersHistoryPage(
  token: string,
  params: {
    from: string;
    to: string;
    page: number;
    pageSize: number;
    captainId?: string;
    storeId?: string;
    status?: string;
  },
): Promise<OrdersHistoryReportPage> {
  const p = new URLSearchParams();
  p.set("from", params.from);
  p.set("to", params.to);
  p.set("page", String(params.page));
  p.set("pageSize", String(params.pageSize));
  if (params.captainId) p.set("captainId", params.captainId);
  if (params.storeId) p.set("storeId", params.storeId);
  if (params.status) p.set("status", params.status);
  return apiFetch<OrdersHistoryReportPage>(`${paths.reports.ordersHistory}?${p.toString()}`, { token });
}
