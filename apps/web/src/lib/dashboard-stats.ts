import { api } from "@/lib/api/singleton";
import { useAuthStore } from "@/stores/auth-store";

export type DashboardStats = {
  ordersTotal: number | null;
  captainsActiveTotal: number | null;
  pendingOrders: number | null;
  confirmedOrders: number | null;
};

/**
 * جلب إحصائيات لوحة واحدة — يُستخدم من `useDashboardStats` ومن route loaders.
 */
export async function loadDashboardStats(opts: {
  canListOrders: boolean;
  isDispatch: boolean;
}): Promise<DashboardStats | null> {
  if (!useAuthStore.getState().token) return null;

  const out: DashboardStats = {
    ordersTotal: null,
    captainsActiveTotal: null,
    pendingOrders: null,
    confirmedOrders: null,
  };

  try {
    if (opts.canListOrders) {
      const o = await api.orders.list({ page: 1, pageSize: 1 });
      out.ordersTotal = o.total;
    }
    if (opts.isDispatch) {
      const [c, p, cf] = await Promise.all([
        api.captains.list({ page: 1, pageSize: 1, isActive: true }),
        api.orders.list({ page: 1, pageSize: 1, status: "PENDING" }),
        api.orders.list({ page: 1, pageSize: 1, status: "CONFIRMED" }),
      ]);
      out.captainsActiveTotal = c.total;
      out.pendingOrders = p.total;
      out.confirmedOrders = cf.total;
    }
    return out;
  } catch {
    return out;
  }
}
