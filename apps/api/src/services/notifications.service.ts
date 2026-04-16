import type { Prisma } from "@prisma/client";
import { notificationRepository } from "../repositories/notification.repository.js";
import { activityService } from "./activity.service.js";

export const notificationService = {
  async create(userId: string, type: string, title: string, body: string, actorUserId?: string | null) {
    const row = await notificationRepository.create({
      user: { connect: { id: userId } },
      type,
      title,
      body,
    });
    if (actorUserId) {
      await activityService.log(actorUserId, "NOTIFICATION_CREATED", "notification", row.id, { targetUserId: userId });
    }
    return row;
  },

  async notifyCaptainTx(
    tx: Prisma.TransactionClient,
    captainUserId: string,
    type: string,
    title: string,
    body: string,
  ) {
    return tx.notification.create({
      data: { userId: captainUserId, type, title, body },
    });
  },

  list(userId: string, params: { isRead?: boolean; page: number; pageSize: number }) {
    return notificationRepository.listForUser(userId, params);
  },

  markRead(id: string, userId: string) {
    return notificationRepository.markRead(id, userId);
  },

  markAllRead(userId: string) {
    return notificationRepository.markAllRead(userId);
  },
};
