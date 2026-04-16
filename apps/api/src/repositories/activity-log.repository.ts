import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export const activityLogRepository = {
  async create(data: Prisma.ActivityLogCreateInput) {
    return prisma.activityLog.create({ data });
  },

  async list(filters: { userId?: string; entityType?: string; entityId?: string; page: number; pageSize: number }) {
    const where: Prisma.ActivityLogWhereInput = {};
    if (filters.userId) where.userId = filters.userId;
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.entityId) where.entityId = filters.entityId;

    const [total, items] = await prisma.$transaction([
      prisma.activityLog.count({ where }),
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
        include: { user: { select: { id: true, fullName: true, phone: true, role: true } } },
      }),
    ]);
    return { total, items };
  },
};
