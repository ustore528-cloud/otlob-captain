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
    const jobs: Array<Promise<void>> = [];

    if (opts.canListOrders) {
      jobs.push(
        api.orders.list({ page: 1, pageSize: 1 }).then((o) => {
          out.ordersTotal = o.total;
        }),
      );
    }

    if (opts.isDispatch) {
      jobs.push(
        Promise.all([
          api.captains.list({ page: 1, pageSize: 1, isActive: true }),
          api.orders.list({ page: 1, pageSize: 1, status: "PENDING" }),
          api.orders.list({ page: 1, pageSize: 1, status: "CONFIRMED" }),
        ]).then(([c, p, cf]) => {
          out.captainsActiveTotal = c.total;
          out.pendingOrders = p.total;
          out.confirmedOrders = cf.total;
        }),
      );
    }

    if (jobs.length > 0) {
      await Promise.all(jobs);
    }
    return out;
  } catch {
    return out;
  }
}
