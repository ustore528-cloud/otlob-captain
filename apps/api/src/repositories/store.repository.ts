import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { normalizePaginationForPrisma } from "../utils/pagination.js";

export const storeRepository = {
  create(data: Prisma.StoreCreateInput) {
    return prisma.store.create({ data, include: { owner: { select: { id: true, fullName: true, phone: true } } } });
  },

  update(id: string, data: Prisma.StoreUpdateInput) {
    return prisma.store.update({
      where: { id },
      data,
      include: { owner: { select: { id: true, fullName: true, phone: true } } },
    });
  },

  findById(id: string) {
    return prisma.store.findUnique({
      where: { id },
      include: { owner: { select: { id: true, fullName: true, phone: true, email: true } } },
    });
  },

  listByOwner(ownerUserId: string, params: { page: number; pageSize: number }) {
    const where: Prisma.StoreWhereInput = { ownerUserId };
    const { skip, take } = normalizePaginationForPrisma(params);
    return prisma.$transaction([
      prisma.store.count({ where }),
      prisma.store.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: { owner: { select: { id: true, fullName: true, phone: true } } },
      }),
    ]);
  },

  list(params: { area?: string; isActive?: boolean; page: number; pageSize: number }) {
    const where: Prisma.StoreWhereInput = {};
    if (params.area) where.area = { contains: params.area, mode: "insensitive" };
    if (params.isActive !== undefined) where.isActive = params.isActive;

    const { skip, take } = normalizePaginationForPrisma(params);

    return prisma.$transaction([
      prisma.store.count({ where }),
      prisma.store.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: { owner: { select: { id: true, fullName: true, phone: true } } },
      }),
    ]);
  },
};
