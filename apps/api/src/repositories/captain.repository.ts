import { CaptainAvailabilityStatus, type Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { normalizePaginationForPrisma } from "../utils/pagination.js";

export const captainRepository = {
  findById(id: string) {
    return prisma.captain.findUnique({
      where: { id },
      include: { user: { select: { id: true, fullName: true, phone: true, email: true, isActive: true } } },
    });
  },

  findByUserId(userId: string) {
    return prisma.captain.findUnique({
      where: { userId },
      include: { user: { select: { id: true, fullName: true, phone: true, email: true, isActive: true } } },
    });
  },

  list(params: {
    area?: string;
    isActive?: boolean;
    availabilityStatus?: CaptainAvailabilityStatus;
    companyId?: string;
    branchId?: string;
    page: number;
    pageSize: number;
  }) {
    const where: Prisma.CaptainWhereInput = {};
    if (params.area) where.area = { contains: params.area, mode: "insensitive" };
    if (params.isActive !== undefined) where.isActive = params.isActive;
    if (params.availabilityStatus) where.availabilityStatus = params.availabilityStatus;
    if (params.companyId) where.companyId = params.companyId;
    if (params.branchId) where.branchId = params.branchId;

    const { skip, take } = normalizePaginationForPrisma(params);

    return prisma.$transaction([
      prisma.captain.count({ where }),
      prisma.captain.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip,
        take,
        include: { user: { select: { id: true, fullName: true, phone: true, isActive: true } } },
      }),
    ]);
  },

  update(id: string, data: Prisma.CaptainUpdateInput) {
    return prisma.captain.update({
      where: { id },
      data,
      include: { user: { select: { id: true, fullName: true, phone: true } } },
    });
  },

  create(data: Prisma.CaptainCreateInput) {
    return prisma.captain.create({
      data,
      include: { user: { select: { id: true, fullName: true, phone: true } } },
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
