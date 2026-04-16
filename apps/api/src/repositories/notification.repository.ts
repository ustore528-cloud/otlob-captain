import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export const notificationRepository = {
  create(data: Prisma.NotificationCreateInput) {
    return prisma.notification.create({ data });
  },

  listForUser(userId: string, params: { isRead?: boolean; page: number; pageSize: number }) {
    const where: Prisma.NotificationWhereInput = { userId };
    if (params.isRead !== undefined) where.isRead = params.isRead;

    return prisma.$transaction([
      prisma.notification.count({ where }),
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
    ]);
  },

  markRead(id: string, userId: string) {
    return prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  },

  markAllRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  },
};
