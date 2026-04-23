import { StoreSubscriptionType } from "@prisma/client";
import { prisma } from "./prisma.js";
import { AppError } from "../utils/errors.js";
import {
  isBranchManagerRole,
  isCompanyAdminRole,
  isDispatcherRole,
  isLegacyAdminRole,
  isOrderOperatorRole,
  isSuperAdminRole,
  type AppRole,
} from "./rbac-roles.js";
import {
  type StaffTenantOrderListFilter,
  resolveStaffTenantOrderListFilter,
} from "../services/tenant-scope.service.js";

/**
 * Read-path only: BRANCH_MANAGER + DISPATCHER with supervised stores/captains
 * are limited to orders for those stores (SUPERVISOR_LINKED + linked user) or
 * orders assigned to captains they supervise. COMPANY_ADMIN / SUPER_ADMIN / legacy
 * ADMIN bypass. No PUBLIC-store union. See tenant-scope for write-path (unchanged).
 */
function bypassesSupervisorReadNarrowing(role: AppRole): boolean {
  if (isSuperAdminRole(role)) return true;
  if (isCompanyAdminRole(role)) return true;
  if (isLegacyAdminRole(role)) return true;
  return false;
}

export async function loadSupervisedStoreAndCaptainIdsForRead(
  userId: string,
  tenant: StaffTenantOrderListFilter,
): Promise<{ storeIds: string[]; captainIds: string[] }> {
  const companyId = tenant.companyId;
  if (!companyId) {
    return { storeIds: [], captainIds: [] };
  }
  const storeWhere = {
    companyId,
    subscriptionType: StoreSubscriptionType.SUPERVISOR_LINKED,
    supervisorUserId: userId,
    ...(tenant.branchId ? { branchId: tenant.branchId } : {}),
  };
  const captainWhere = {
    companyId,
    supervisorUserId: userId,
    ...(tenant.branchId ? { branchId: tenant.branchId } : {}),
  };
  const [stores, captains] = await prisma.$transaction([
    prisma.store.findMany({ where: storeWhere, select: { id: true } }),
    prisma.captain.findMany({ where: captainWhere, select: { id: true } }),
  ]);
  return {
    storeIds: stores.map((s) => s.id),
    captainIds: captains.map((c) => c.id),
  };
}

/**
 * When non-empty, staff order list must add OR(storeId in storeIds, assignedCaptainId in captainIds).
 */
export async function resolveSupervisorReadScopeForList(
  actor: { userId: string; role: AppRole; companyId: string | null; branchId: string | null },
): Promise<{ storeIds: string[]; captainIds: string[] } | null> {
  if (!isOrderOperatorRole(actor.role)) return null;
  if (bypassesSupervisorReadNarrowing(actor.role)) return null;
  if (!isBranchManagerRole(actor.role) && !isDispatcherRole(actor.role)) return null;
  const tenant = await resolveStaffTenantOrderListFilter(actor);
  const { storeIds, captainIds } = await loadSupervisedStoreAndCaptainIdsForRead(actor.userId, tenant);
  if (storeIds.length === 0 && captainIds.length === 0) return null;
  return { storeIds, captainIds };
}

/**
 * getById read scoping: after tenant `assertStaffCanAccessOrder`, reject BM/D
 * with supervised links when the order is outside store ∪ captain scope.
 */
export async function assertSupervisorReadAccessForOrder(
  actor: { userId: string; role: AppRole; companyId: string | null; branchId: string | null },
  order: { storeId: string; assignedCaptainId: string | null },
): Promise<void> {
  if (!isOrderOperatorRole(actor.role)) return;
  if (bypassesSupervisorReadNarrowing(actor.role)) return;
  if (!isBranchManagerRole(actor.role) && !isDispatcherRole(actor.role)) return;
  const tenant = await resolveStaffTenantOrderListFilter(actor);
  const { storeIds, captainIds } = await loadSupervisedStoreAndCaptainIdsForRead(actor.userId, tenant);
  if (storeIds.length === 0 && captainIds.length === 0) return;

  const byStore = storeIds.includes(order.storeId);
  const byCaptain =
    order.assignedCaptainId != null && captainIds.includes(order.assignedCaptainId);
  if (!byStore && !byCaptain) {
    throw new AppError(403, "Forbidden", "FORBIDDEN");
  }
}
