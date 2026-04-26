import { CaptainAvailabilityStatus, type Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { orderStoreSupervisorUserSelect } from "./order-store-enrichment.js";
import { normalizePaginationForPrisma } from "../utils/pagination.js";

const captainUserSelectDetail = {
  id: true,
  fullName: true,
  phone: true,
  email: true,
  isActive: true,
} as const satisfies Prisma.UserSelect;

const captainUserSelectList = {
  id: true,
  fullName: true,
  phone: true,
  isActive: true,
} as const satisfies Prisma.UserSelect;

/** Read path: `user` + optional `supervisorUser` (same shape as order store supervisor summary). */
export const captainWithRelationsInclude = {
  user: { select: captainUserSelectDetail },
  supervisorUser: { select: orderStoreSupervisorUserSelect },
  createdByUser: { select: { id: true, fullName: true, role: true } },
} satisfies Prisma.CaptainInclude;

const captainListInclude = {
  user: { select: captainUserSelectList },
  supervisorUser: { select: orderStoreSupervisorUserSelect },
  createdByUser: { select: { id: true, fullName: true, role: true } },
} satisfies Prisma.CaptainInclude;

export const captainRepository = {
  findById(id: string) {
    return prisma.captain.findUnique({
      where: { id },
      include: captainWithRelationsInclude,
    });
  },

  findByUserId(userId: string) {
    return prisma.captain.findUnique({
      where: { userId },
      include: captainWithRelationsInclude,
    });
  },

  list(params: {
    area?: string;
    isActive?: boolean;
    availabilityStatus?: CaptainAvailabilityStatus;
    companyId?: string;
    branchId?: string;
    createdByUserId?: string;
    page: number;
    pageSize: number;
  }) {
    const where: Prisma.CaptainWhereInput = {};
    if (params.area) where.area = { contains: params.area, mode: "insensitive" };
    if (params.isActive !== undefined) where.isActive = params.isActive;
    if (params.availabilityStatus) where.availabilityStatus = params.availabilityStatus;
    if (params.companyId) where.companyId = params.companyId;
    if (params.branchId) where.branchId = params.branchId;
    if (params.createdByUserId) where.createdByUserId = params.createdByUserId;

    const { skip, take } = normalizePaginationForPrisma(params);

    return prisma.$transaction([
      prisma.captain.count({ where }),
      prisma.captain.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip,
        take,
        include: captainListInclude,
      }),
    ]);
  },

  update(id: string, data: Prisma.CaptainUpdateInput) {
    return prisma.captain.update({
      where: { id },
      data,
      include: captainWithRelationsInclude,
    });
  },

  create(data: Prisma.CaptainCreateInput) {
    return prisma.captain.create({
      data,
      include: captainWithRelationsInclude,
    });
  },

  /** كباتن نشطون ومتاحون للتوزيع */
  findActiveForDistribution(branchId: string) {
    return prisma.captain.findMany({
      where: {
        branchId,
        isActive: true,
        availabilityStatus: CaptainAvailabilityStatus.AVAILABLE,
        user: { isActive: true },
      },
      orderBy: { id: "asc" },
    });
  },
};
