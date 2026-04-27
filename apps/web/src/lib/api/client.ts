import { ApiError } from "@/lib/api/http";
import * as activity from "@/lib/api/services/activity";
import * as dashboardSettings from "@/lib/api/services/dashboard-settings";
import * as finance from "@/lib/api/services/finance";
import * as geocode from "@/lib/api/services/geocode";
import * as captains from "@/lib/api/services/captains";
import * as notifications from "@/lib/api/services/notifications";
import * as orders from "@/lib/api/services/orders";
import * as reports from "@/lib/api/services/reports";
import * as stores from "@/lib/api/services/stores";
import * as superAdminWallets from "@/lib/api/services/super-admin-wallets";
import * as supervisorCaptainTransfer from "@/lib/api/services/supervisor-captain-transfer";
import * as tracking from "@/lib/api/services/tracking";
import * as users from "@/lib/api/services/users";
import * as branches from "@/lib/api/services/branches";
import * as zones from "@/lib/api/services/zones";
import * as companies from "@/lib/api/services/companies";

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
      getById: (id: string) => orders.getOrderById(t(), id),
      create: (body: orders.CreateOrderPayload) => orders.createOrder(t(), body),
      distributionAuto: (orderId: string) => orders.distributionAuto(t(), orderId),
      distributionAutoAssignVisible: (body: { orderIds: string[]; zoneId?: string }) =>
        orders.distributionAutoAssignVisible(t(), body),
      distributionResend: (orderId: string) => orders.distributionResend(t(), orderId),
      distributionManual: (orderId: string, captainId: string) => orders.distributionManual(t(), orderId, captainId),
      distributionDragDrop: (orderId: string, captainId: string) =>
        orders.distributionDragDrop(t(), orderId, captainId),
      distributionReassign: (orderId: string, captainId: string) =>
        orders.distributionReassign(t(), orderId, captainId),
      distributionCancelCaptain: (orderId: string) => orders.distributionCancelCaptain(t(), orderId),
      archive: (orderId: string) => orders.archiveOrder(t(), orderId),
      unarchive: (orderId: string) => orders.unarchiveOrder(t(), orderId),
      adminOverrideStatus: (orderId: string, status: Parameters<typeof orders.adminOverrideOrderStatus>[2]) =>
        orders.adminOverrideOrderStatus(t(), orderId, status),
    },
    captains: {
      get: (id: string) => captains.getCaptain(t(), id),
      list: (q?: Parameters<typeof captains.listCaptains>[1]) => captains.listCaptains(t(), q),
      create: (body: captains.CreateCaptainPayload) => captains.createCaptain(t(), body),
      setActive: (id: string, isActive: boolean) => captains.setCaptainActive(t(), id, isActive),
      stats: (id: string) => captains.getCaptainStats(t(), id),
      orders: (id: string, q?: Parameters<typeof captains.listCaptainOrders>[2]) =>
        captains.listCaptainOrders(t(), id, q),
      update: (id: string, body: captains.UpdateCaptainPayload) => captains.updateCaptain(t(), id, body),
      delete: (id: string) => captains.deleteCaptain(t(), id),
      prepaidSummary: (id: string) => captains.getCaptainPrepaidSummary(t(), id),
      prepaidTransactions: (id: string, q?: Parameters<typeof captains.listCaptainPrepaidTransactions>[2]) =>
        captains.listCaptainPrepaidTransactions(t(), id, q),
      prepaidCharge: (id: string, body: Parameters<typeof captains.chargeCaptainPrepaidBalance>[2]) =>
        captains.chargeCaptainPrepaidBalance(t(), id, body),
      prepaidAdjustment: (id: string, body: Parameters<typeof captains.adjustCaptainPrepaidBalance>[2]) =>
        captains.adjustCaptainPrepaidBalance(t(), id, body),
    },
    companies: {
      list: () => companies.listCompanies(t()),
      create: (body: { name: string }) => companies.createCompany(t(), body),
      getDeletePreview: (companyId: string) => companies.getCompanyDeletePreview(t(), companyId),
      archive: (companyId: string, body: { confirmPhrase: string }) =>
        companies.archiveCompany(t(), companyId, body),
    },
    branches: {
      list: (q?: { companyId?: string }) => branches.listBranches(t(), q ?? {}),
    },
    zones: {
      list: (q?: { companyId?: string }) => zones.listZones(t(), q ?? {}),
    },
    users: {
      list: (q?: Parameters<typeof users.listUsers>[1]) => users.listUsers(t(), q),
      create: (body: users.CreateUserPayload) => users.createUser(t(), body),
      setActive: (id: string, isActive: boolean) => users.setUserActive(t(), id, isActive),
      updateCustomerProfile: (id: string, body: users.UpdateCustomerProfilePayload) =>
        users.updateUserCustomerProfile(t(), id, body),
    },
    stores: {
      list: (page?: number, pageSize?: number) => stores.listStores(t(), page, pageSize),
      update: (id: string, body: stores.UpdateStorePayload) => stores.updateStore(t(), id, body),
    },
    tracking: {
      activeMap: () => tracking.activeCaptainsMap(t()),
      latestLocations: (captainIds: string[]) => tracking.latestCaptainLocations(t(), captainIds),
    },
    notifications: {
      list: (page?: number, pageSize?: number) => notifications.listNotifications(t(), page, pageSize),
      create: (payload: notifications.CreateCaptainNotificationPayload) =>
        notifications.createNotification(t(), payload),
      quickStatus: (status: notifications.QuickStatusCode) => notifications.sendQuickStatus(t(), status),
    },
    activity: {
      list: (page?: number, pageSize?: number) => activity.listActivity(t(), page, pageSize),
    },
    dashboardSettings: {
      get: () => dashboardSettings.getDashboardSettings(t()),
      patch: (body: dashboardSettings.DashboardSettingsPatchPayload) =>
        dashboardSettings.patchDashboardSettings(t(), body),
    },
    geocode: {
      place: (params: { country?: string | null; city?: string | null }) => geocode.geocodePlace(t(), params),
    },
    finance: {
      getStoreWallet: (storeId: string) => finance.getStoreWallet(t(), storeId),
      getCaptainWallet: (captainId: string) => finance.getCaptainWallet(t(), captainId),
      getMySupervisorWallet: () => finance.getMySupervisorWallet(t()),
      getMyCompanyWallet: () => finance.getMyCompanyWallet(t()),
      getCompanyWalletById: (companyId: string) => finance.getCompanyWalletById(t(), companyId),
      getLedgerPage: (walletAccountId: string, offset: number, limit?: number) =>
        finance.getLedgerHistoryPage(t(), walletAccountId, offset, limit),
      getLedgerActivityReport: (
        walletAccountId: string,
        args: { from: string; to: string; offset: number; limit?: number },
      ) => finance.getLedgerActivityReport(t(), walletAccountId, args),
      companyAdminTopUpStore: (storeId: string, body: Parameters<typeof finance.postCompanyAdminStoreTopUp>[2]) =>
        finance.postCompanyAdminStoreTopUp(t(), storeId, body),
      companyAdminPrepaidChargeCaptain: (captainId: string, body: Parameters<typeof finance.postCompanyAdminCaptainPrepaid>[2]) =>
        finance.postCompanyAdminCaptainPrepaid(t(), captainId, body),
    },
    superAdminWallets: {
      topUpStore: (storeId: string, input: { amount: string; idempotencyKey: string }) =>
        superAdminWallets.topUpStoreWallet(t(), storeId, input),
      topUpSupervisorUser: (userId: string, input: { amount: string; idempotencyKey: string }) =>
        superAdminWallets.topUpSupervisorUserWallet(t(), userId, input),
      adjustSupervisorUser: (userId: string, input: { amount: string; note: string; idempotencyKey: string }) =>
        superAdminWallets.adjustSupervisorUserWallet(t(), userId, input),
      topUpCompany: (
        companyId: string,
        input: { amount: string; reason: string; idempotencyKey: string; currency?: string },
      ) => superAdminWallets.topUpCompanyWallet(t(), companyId, input),
    },
    supervisorWallets: {
      transferToCaptain: (input: { captainId: string; amount: string; idempotencyKey: string }) =>
        supervisorCaptainTransfer.transferSupervisorToCaptain(t(), input),
    },
    reports: {
      getReconciliationSummary: (args: { from: string; to: string }) =>
        reports.getReconciliationSummary(t(), args),
      getDeliveredCommissionsPage: (args: { from: string; to: string; page: number; pageSize: number }) =>
        reports.getDeliveredCommissionsPage(t(), args),
      getOrdersHistoryPage: (args: {
        from: string;
        to: string;
        page: number;
        pageSize: number;
        captainId?: string;
        storeId?: string;
        status?: string;
      }) => reports.getOrdersHistoryPage(t(), args),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
