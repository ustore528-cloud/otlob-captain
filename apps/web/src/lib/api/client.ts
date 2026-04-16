import { ApiError } from "@/lib/api/http";
import * as activity from "@/lib/api/services/activity";
import * as captains from "@/lib/api/services/captains";
import * as notifications from "@/lib/api/services/notifications";
import * as orders from "@/lib/api/services/orders";
import * as stores from "@/lib/api/services/stores";
import * as tracking from "@/lib/api/services/tracking";
import * as users from "@/lib/api/services/users";

export type GetToken = () => string | null;

function requireToken(getToken: GetToken): string {
  const t = getToken();
  if (!t) throw new ApiError("يجب تسجيل الدخول", 401, "NO_TOKEN");
  return t;
}

/**
 * عميل REST مركزي — يقرأ التوكن ديناميكياً (جاهز لإعادة الاستخدام من تطبيق جوال لاحقاً).
 */
export function createApiClient(getToken: GetToken) {
  const t = () => requireToken(getToken);

  return {
    orders: {
      list: (q: Parameters<typeof orders.listOrders>[1]) => orders.listOrders(t(), q),
      create: (body: orders.CreateOrderPayload) => orders.createOrder(t(), body),
      distributionAuto: (orderId: string) => orders.distributionAuto(t(), orderId),
      distributionResend: (orderId: string) => orders.distributionResend(t(), orderId),
      distributionManual: (orderId: string, captainId: string) => orders.distributionManual(t(), orderId, captainId),
      distributionDragDrop: (orderId: string, captainId: string) =>
        orders.distributionDragDrop(t(), orderId, captainId),
    },
    captains: {
      list: (q?: Parameters<typeof captains.listCaptains>[1]) => captains.listCaptains(t(), q),
      create: (body: captains.CreateCaptainPayload) => captains.createCaptain(t(), body),
      setActive: (id: string, isActive: boolean) => captains.setCaptainActive(t(), id, isActive),
      stats: (id: string) => captains.getCaptainStats(t(), id),
    },
    users: {
      list: (q?: Parameters<typeof users.listUsers>[1]) => users.listUsers(t(), q),
      setActive: (id: string, isActive: boolean) => users.setUserActive(t(), id, isActive),
    },
    stores: {
      list: (page?: number, pageSize?: number) => stores.listStores(t(), page, pageSize),
    },
    tracking: {
      activeMap: () => tracking.activeCaptainsMap(t()),
      latestLocations: (captainIds: string[]) => tracking.latestCaptainLocations(t(), captainIds),
    },
    notifications: {
      list: (page?: number, pageSize?: number) => notifications.listNotifications(t(), page, pageSize),
    },
    activity: {
      list: (page?: number, pageSize?: number) => activity.listActivity(t(), page, pageSize),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
