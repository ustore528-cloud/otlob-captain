import type { Prisma } from "@prisma/client";
import { storeRepository } from "../repositories/store.repository.js";
import { AppError } from "../utils/errors.js";
import { activityService } from "./activity.service.js";

export const storesService = {
  async create(
    input: { name: string; phone: string; area: string; address: string; ownerUserId: string },
    actorUserId: string,
  ) {
    const store = await storeRepository.create({
      name: input.name,
      phone: input.phone,
      area: input.area,
      address: input.address,
      owner: { connect: { id: input.ownerUserId } },
    });
    await activityService.log(actorUserId, "STORE_CREATED", "store", store.id, {});
    return store;
  },

  async update(
    id: string,
    input: Partial<{ name: string; phone: string; area: string; address: string; ownerUserId: string; isActive: boolean }>,
    actorUserId: string,
    opts: { role: string; userId: string; storeId: string | null },
  ) {
    const existing = await storeRepository.findById(id);
    if (!existing) throw new AppError(404, "Store not found", "NOT_FOUND");
    if (opts.role === "STORE" && existing.ownerUserId !== opts.userId) {
      throw new AppError(403, "Forbidden", "FORBIDDEN");
    }

    const data: Prisma.StoreUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.area !== undefined) data.area = input.area;
    if (input.address !== undefined) data.address = input.address;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.ownerUserId !== undefined) {
      if (opts.role !== "ADMIN" && opts.role !== "DISPATCHER") {
        throw new AppError(403, "Cannot change owner", "FORBIDDEN");
      }
      data.owner = { connect: { id: input.ownerUserId } };
    }

    const store = await storeRepository.update(id, data);
    await activityService.log(actorUserId, "STORE_UPDATED", "store", id, {});
    return store;
  },

  async list(params: { area?: string; isActive?: boolean; page: number; pageSize: number }, opts: { role: string; userId: string }) {
    if (opts.role === "STORE") {
      return storeRepository.listByOwner(opts.userId, { page: params.page, pageSize: params.pageSize });
    }
    return storeRepository.list(params);
  },

  async getById(id: string, opts: { role: string; userId: string }) {
    const store = await storeRepository.findById(id);
    if (!store) throw new AppError(404, "Store not found", "NOT_FOUND");
    if (opts.role === "STORE" && store.ownerUserId !== opts.userId) {
      throw new AppError(403, "Forbidden", "FORBIDDEN");
    }
    return store;
  },
};
