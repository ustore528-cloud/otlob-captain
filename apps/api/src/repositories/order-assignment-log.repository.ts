import type { Prisma, AssignmentResponseStatus, AssignmentType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export const orderAssignmentLogRepository = {
  create(data: Prisma.OrderAssignmentLogCreateInput) {
    return prisma.orderAssignmentLog.create({ data });
  },

  findPendingExpiredBefore(date: Date) {
    return prisma.orderAssignmentLog.findMany({
      where: {
        responseStatus: "PENDING",
        expiredAt: { lte: date },
      },
      include: { order: true, captain: true },
    });
  },

  updateStatus(id: string, responseStatus: AssignmentResponseStatus, notes?: string) {
    return prisma.orderAssignmentLog.update({
      where: { id },
      data: { responseStatus, ...(notes !== undefined ? { notes } : {}) },
    });
  },

  countAutoAttemptsForOrder(orderId: string) {
    return prisma.orderAssignmentLog.count({
      where: {
        orderId,
        assignmentType: { in: ["AUTO", "REASSIGN"] as AssignmentType[] },
      },
    });
  },

  findLatestForOrder(orderId: string) {
    return prisma.orderAssignmentLog.findFirst({
      where: { orderId },
      orderBy: { assignedAt: "desc" },
    });
  },

  findPendingForCaptain(orderId: string, captainId: string) {
    return prisma.orderAssignmentLog.findFirst({
      where: { orderId, captainId, responseStatus: "PENDING" },
    });
  },

  cancelPendingForOrder(orderId: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? prisma;
    return client.orderAssignmentLog.updateMany({
      where: { orderId, responseStatus: "PENDING" },
      data: { responseStatus: "CANCELLED", notes: "Cancelled by system or user action" },
    });
  },
};
