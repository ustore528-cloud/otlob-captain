import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export const activityService = {
  async log(
    userId: string | null,
    action: string,
    entityType: string,
    entityId: string,
    metadata?: Record<string, unknown>,
  ) {
    await prisma.activityLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        metadata: metadata as Prisma.InputJsonValue | undefined,
      },
    });
  },

  async logTx(
    tx: Prisma.TransactionClient,
    userId: string | null,
    action: string,
    entityType: string,
    entityId: string,
    metadata?: Record<string, unknown>,
  ) {
    await tx.activityLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        metadata: metadata as Prisma.InputJsonValue | undefined,
      },
    });
  },
};
