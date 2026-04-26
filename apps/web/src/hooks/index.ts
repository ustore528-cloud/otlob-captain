export { useApiClient } from "./use-api-client";

export { useOrders } from "./orders/use-orders";
export { useOrderDetail } from "./orders/use-order-detail";
export { useCreateOrder } from "./orders/use-create-order";
export { useIncubatorCreateOrderWithDistribution } from "./incubator/use-incubator-create-order-with-distribution";
export { useResendOrderToDistribution } from "./orders/use-resend-order-to-distribution";
export { useReassignOrder } from "./orders/use-reassign-order";
export { useAssignOrderToCaptain, type AssignOrderMode, type AssignOrderToCaptainVariables } from "./orders/use-assign-order-to-captain";
export { useStartOrderAutoDistribution } from "./orders/use-start-order-auto-distribution";
export { useCancelOrderCaptainAssignment } from "./orders/use-cancel-order-captain-assignment";
export { useArchiveOrder } from "./orders/use-archive-order";
export {
  useAdminOverrideOrderStatus,
  ADMIN_OVERRIDE_TARGET_STATUSES,
  type AdminOverrideTargetStatus,
} from "./orders/use-admin-override-order-status";

export { useCaptains, DEFAULT_CAPTAINS_LIST } from "./captains/use-captains";
export { useToggleCaptain } from "./captains/use-toggle-captain";
export { useCreateCaptain } from "./captains/use-create-captain";
export { useBranches } from "./branches/use-branches";
export { useZones } from "./zones/use-zones";
export { useCompaniesForSuperAdmin } from "./companies/use-companies-for-super-admin";
export { useCaptainStats } from "./captains/use-captain-stats";
export { useCaptainOrdersReport } from "./captains/use-captain-orders-report";
export { useUpdateCaptain } from "./captains/use-update-captain";
export { useDeleteCaptain } from "./captains/use-delete-captain";

export { useUsers } from "./users/use-users";
export { useCreateUser } from "./users/use-create-user";
export { useToggleUserActive } from "./users/use-toggle-user-active";
export { useUpdateUserCustomerProfile } from "./users/use-update-user-customer-profile";

export { useDashboardStats } from "./dashboard/use-dashboard-stats";
export { useDashboardSettings } from "./dashboard/use-dashboard-settings";
export { useUpdateDashboardSettings } from "./dashboard/use-update-dashboard-settings";

export { useCaptainLocations } from "./tracking/use-captain-locations";

export { useStores } from "./stores/use-stores";
export { useUpdateStore } from "./stores/use-update-store";
export { useNotifications } from "./notifications/use-notifications";
export { useSendQuickStatusAlert, type QuickStatusCode } from "./notifications/use-send-quick-status-alert";
export { useActivityList } from "./activity/use-activity-list";
