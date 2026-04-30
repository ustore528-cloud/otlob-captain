import type { Prisma, StoreSubscriptionType } from "@prisma/client";
import { assertStoreSupervisorLinkValid } from "../lib/store-supervisor-validation.js";
import { storeRepository } from "../repositories/store.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { AppError } from "../utils/errors.js";
import { activityService } from "./activity.service.js";
import { resolveBranchIdForStaffOperation, resolveStaffTenantOrderListFilter } from "./tenant-scope.service.js";
import { isManagementAdminRole, isOrderOperatorRole, isStoreAdminRole, isSuperAdminRole, type AppRole } from "../lib/rbac-roles.js";

export const storesService = {
  async create(
    input: {
      name: string;
      phone: string;
      area: string;
      address: string;
      ownerUserId: string;
      branchId?: string;
      subscriptionType?: StoreSubscriptionType;
      supervisorUserId?: string | null;
    },
    actorUserId: string,
  ) {
    const { companyId, branchId } = await resolveBranchIdForStaffOperation(actorUserId, input.branchId);
    const subscriptionType = input.subscriptionType ?? "PUBLIC";
    const supervisorForAssert = await (async () => {
      if (subscriptionType !== "SUPERVISOR_LINKED") {
        return null;
      }
      if (!input.supervisorUserId) {
        return null;
      }
      return userRepository.findById(input.supervisorUserId);
    })();
    if (subscriptionType === "SUPERVISOR_LINKED" && !supervisorForAssert) {
      throw new AppError(400, "Supervisor user not found", "VALIDATION_ERROR");
    }
    assertStoreSupervisorLinkValid({
      subscriptionType,
      supervisorUser: subscriptionType === "SUPERVISOR_LINKED" && supervisorForAssert ? supervisorForAssert : null,
      storeCompanyId: companyId,
      storeBranchId: branchId,
    });

    const data: Prisma.StoreCreateInput = {
      name: input.name,
      phone: input.phone,
      area: input.area,
      address: input.address,
      subscriptionType,
      company: { connect: { id: companyId } },
      branch: { connect: { id: branchId } },
      owner: { connect: { id: input.ownerUserId } },
    };
    if (subscriptionType === "SUPERVISOR_LINKED" && input.supervisorUserId) {
      data.supervisorUser = { connect: { id: input.supervisorUserId } };
    }
    const store = await storeRepository.create(data);
    await activityService.log(actorUserId, "STORE_CREATED", "store", store.id, {});
    return store;
  },

  async update(
    id: string,
    input: Partial<{
      name: string;
      phone: string;
      area: string;
      address: string;
      ownerUserId: string;
      isActive: boolean;
      subscriptionType: StoreSubscriptionType;
      /** explicit null disconnects; omit leaves unchanged */
      supervisorUserId: string | null;
    }>,
    actorUserId: string,
    opts: { role: AppRole; userId: string; storeId: string | null; companyId: string | null; branchId: string | null },
  ) {
    const existing = await storeRepository.findById(id);
    if (!existing) throw new AppError(404, "Store not found", "NOT_FOUND");
    if (isStoreAdminRole(opts.role)) {
      if (input.subscriptionType !== undefined || input.supervisorUserId !== undefined) {
        throw new AppError(403, "Store cannot change subscription or supervisor", "FORBIDDEN");
      }
    }
    if (isOrderOperatorRole(opts.role)) {
      const tenant = await resolveStaffTenantOrderListFilter({
        userId: opts.userId,
        role: opts.role,
        companyId: opts.companyId ?? null,
        branchId: opts.branchId ?? null,
      });
      if (existing.companyId !== tenant.companyId || (tenant.branchId && existing.branchId !== tenant.branchId)) {
        throw new AppError(403, "Forbidden", "FORBIDDEN");
      }
    }
    if (isStoreAdminRole(opts.role) && existing.ownerUserId !== opts.userId) {
      throw new AppError(403, "Forbidden", "FORBIDDEN");
    }

    const subscriptionTouched =
      input.subscriptionType !== undefined || input.supervisorUserId !== undefined;
    let resolvedSubscription: { type: StoreSubscriptionType; supervisorId: string | null } | undefined;
    if (subscriptionTouched) {
      const nextType = input.subscriptionType ?? existing.subscriptionType;
      let nextSupervisorId: string | null =
        input.supervisorUserId !== undefined
          ? input.supervisorUserId
          : (existing.supervisorUserId ?? null);
      if (nextType === "PUBLIC") {
        nextSupervisorId = null;
      }
      if (nextType === "SUPERVISOR_LINKED" && !nextSupervisorId) {
        throw new AppError(400, "SUPERVISOR_LINKED store requires a valid supervisor", "VALIDATION_ERROR");
      }
      const supervisorUserRow =
        nextType === "SUPERVISOR_LINKED" && nextSupervisorId
          ? await userRepository.findById(nextSupervisorId)
          : null;
      if (nextType === "SUPERVISOR_LINKED" && !supervisorUserRow) {
        throw new AppError(400, "Supervisor user not found", "VALIDATION_ERROR");
      }
      assertStoreSupervisorLinkValid({
        subscriptionType: nextType,
        supervisorUser: nextType === "PUBLIC" ? null : supervisorUserRow!,
        storeCompanyId: existing.companyId,
        storeBranchId: existing.branchId,
      });
      resolvedSubscription = { type: nextType, supervisorId: nextSupervisorId };
    }

    const data: Prisma.StoreUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.area !== undefined) data.area = input.area;
    if (input.address !== undefined) data.address = input.address;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.ownerUserId !== undefined) {
      if (!isManagementAdminRole(opts.role)) {
        throw new AppError(403, "Cannot change owner", "FORBIDDEN");
      }
      data.owner = { connect: { id: input.ownerUserId } };
    }
    if (resolvedSubscription) {
      data.subscriptionType = resolvedSubscription.type;
      data.supervisorUser = resolvedSubscription.supervisorId
        ? { connect: { id: resolvedSubscription.supervisorId } }
        : { disconnect: true };
    }

    const store = await storeRepository.update(id, data);
    await activityService.log(actorUserId, "STORE_UPDATED", "store", id, {});
    return store;
  },

  async list(
    params: { area?: string; isActive?: boolean; companyId?: string; page: number; pageSize: number },
    opts: {
      role: AppRole;
      userId: string;
      companyId: string | null;
      branchId: string | null;
    },
  ) {
    if (isStoreAdminRole(opts.role)) {
      return storeRepository.listByOwner(opts.userId, { page: params.page, pageSize: params.pageSize });
    }
    if (isOrderOperatorRole(opts.role)) {
      const tenant = await resolveStaffTenantOrderListFilter({
        userId: opts.userId,
        role: opts.role,
        companyId: opts.companyId ?? null,
        branchId: opts.branchId ?? null,
      });
      const superAdminCompanyId = isSuperAdminRole(opts.role) ? params.companyId : undefined;
      return storeRepository.list({
        ...params,
        companyId: superAdminCompanyId ?? tenant.companyId,
        branchId: tenant.branchId,
      });
    }
    return storeRepository.list(params);
  },

  async getById(id: string, opts: { role: AppRole; userId: string; companyId: string | null; branchId: string | null }) {
    const store = await storeRepository.findById(id);
    if (!store) throw new AppError(404, "Store not found", "NOT_FOUND");
    if (isOrderOperatorRole(opts.role)) {
      const tenant = await resolveStaffTenantOrderListFilter({
        userId: opts.userId,
        role: opts.role,
        companyId: opts.companyId ?? null,
        branchId: opts.branchId ?? null,
      });
      if (store.companyId !== tenant.companyId || (tenant.branchId && store.branchId !== tenant.branchId)) {
        throw new AppError(403, "Forbidden", "FORBIDDEN");
      }
    }
    if (isStoreAdminRole(opts.role) && store.ownerUserId !== opts.userId) {
      throw new AppError(403, "Forbidden", "FORBIDDEN");
    }
    return store;
  },
};
