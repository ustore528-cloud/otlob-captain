import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { storePrimaryRegionSummarySelect } from "./order-store-enrichment.js";
import { normalizePaginationForPrisma } from "../utils/pagination.js";

const supervisorUserSelect = {
  id: true,
  fullName: true,
  phone: true,
  email: true,
  role: true,
  companyId: true,
  branchId: true,
} as const satisfies Prisma.UserSelect;

const storeListInclude = {
  owner: { select: { id: true, fullName: true, phone: true } },
  supervisorUser: { select: supervisorUserSelect },
  primaryRegion: { select: storePrimaryRegionSummarySelect },
} as const;

const storeDetailInclude = {
  owner: { select: { id: true, fullName: true, phone: true, email: true } },
  supervisorUser: { select: supervisorUserSelect },
  primaryRegion: { select: storePrimaryRegionSummarySelect },
} as const;

export const storeRepository = {
  create(data: Prisma.StoreCreateInput) {
    return prisma.store.create({ data, include: storeDetailInclude });
  },

  update(id: string, data: Prisma.StoreUpdateInput) {
    return prisma.store.update({
      where: { id },
      data,
      include: storeDetailInclude,
    });
  },

  findById(id: string) {
    return prisma.store.findUnique({
      where: { id },
      include: storeDetailInclude,
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
        include: storeListInclude,
      }),
    ]);
  },

  list(params: {
    area?: string;
    isActive?: boolean;
    companyId?: string;
    branchId?: string;
    page: number;
    pageSize: number;
  }) {
    const where: Prisma.StoreWhereInput = {};
    if (params.area) where.area = { contains: params.area, mode: "insensitive" };
    if (params.isActive !== undefined) where.isActive = params.isActive;
    if (params.companyId) where.companyId = params.companyId;
    if (params.branchId) where.branchId = params.branchId;

    const { skip, take } = normalizePaginationForPrisma(params);

    return prisma.$transaction([
      prisma.store.count({ where }),
      prisma.store.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: storeListInclude,
      }),
    ]);
  },
};
