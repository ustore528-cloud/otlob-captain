import type { Prisma, UserRole } from "@prisma/client";
import { storeRepository } from "../repositories/store.repository.js";
import { AppError } from "../utils/errors.js";
import { activityService } from "./activity.service.js";
import { resolveBranchIdForStaffOperation, resolveStaffTenantOrderListFilter } from "./tenant-scope.service.js";
import { isManagementAdminRole, isOrderOperatorRole, isStoreAdminRole, type AppRole } from "../lib/rbac-roles.js";

export const storesService = {
  async create(
    input: {
      name: string;
      phone: string;
      area: string;
      address: string;
      ownerUserId: string;
      branchId?: string;
    },
    actorUserId: string,
  ) {
    const { companyId, branchId } = await resolveBranchIdForStaffOperation(actorUserId, input.branchId);
    const store = await storeRepository.create({
      name: input.name,
      phone: input.phone,
      area: input.area,
      address: input.address,
      company: { connect: { id: companyId } },
      branch: { connect: { id: branchId } },
      owner: { connect: { id: input.ownerUserId } },
    });
    await activityService.log(actorUserId, "STORE_CREATED", "store", store.id, {});
    return store;
  },

  async update(
    id: string,
    input: Partial<{ name: string; phone: string; area: string; address: string; ownerUserId: string; isActive: boolean }>,
    actorUserId: string,
    opts: { role: AppRole; userId: string; storeId: string | null; companyId: string | null; branchId: string | null },
  ) {
    const existing = await storeRepository.findById(id);
    if (!existing) throw new AppError(404, "Store not found", "NOT_FOUND");
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

    const store = await storeRepository.update(id, data);
    await activityService.log(actorUserId, "STORE_UPDATED", "store", id, {});
    return store;
  },

  async list(
    params: { area?: string; isActive?: boolean; page: number; pageSize: number },
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
      return storeRepository.list({
        ...params,
        companyId: tenant.companyId,
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
