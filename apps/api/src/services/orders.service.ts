import { DistributionMode, OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { orderRepository } from "../repositories/order.repository.js";
import { captainRepository } from "../repositories/captain.repository.js";
import { AppError } from "../utils/errors.js";
import { generateOrderNumber } from "../utils/order-number.js";
import { activityService } from "./activity.service.js";
import { distributionService } from "./distribution/index.js";
import { assertCaptainOrderStatusTransition } from "../domain/order-captain-status.js";
import {
  emitCaptainAssignmentEnded,
  emitCaptainOrderUpdated,
  emitDispatcherOrderUpdated,
} from "../realtime/order-emits.js";

export const ordersService = {
  async create(
    input: {
      storeId?: string;
      customerName: string;
      customerPhone: string;
      pickupAddress: string;
      dropoffAddress: string;
      area: string;
      amount: number;
      cashCollection?: number;
      dropoffLatitude?: number;
      dropoffLongitude?: number;
      notes?: string;
      distributionMode?: "AUTO" | "MANUAL";
    },
    actor: { userId: string; role: string; storeId: string | null },
  ) {
    let resolvedStoreId = input.storeId;

    if (actor.role === "STORE") {
      if (!actor.storeId || (resolvedStoreId && resolvedStoreId !== actor.storeId)) {
        throw new AppError(403, "Cannot create order for another store", "FORBIDDEN");
      }
      resolvedStoreId = actor.storeId;
    }

    if (!resolvedStoreId && (actor.role === "ADMIN" || actor.role === "DISPATCHER")) {
      const existing = await prisma.store.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
      });
      if (existing) {
        resolvedStoreId = existing.id;
      } else {
        const operationalStore = await prisma.store.create({
          data: {
            name: "متجر التشغيل",
            phone: "0000000000",
            area: "عام",
            address: "تشغيل النظام (بدون متجر فعلي)",
            ownerUserId: actor.userId,
            isActive: true,
          },
        });
        resolvedStoreId = operationalStore.id;
      }
    }

    if (!resolvedStoreId) {
      throw new AppError(400, "storeId is required", "BAD_REQUEST");
    }

    const store = await prisma.store.findUnique({ where: { id: resolvedStoreId } });
    if (!store?.isActive) throw new AppError(400, "Store not found or inactive", "BAD_REQUEST");

    const notesWithCoords =
      input.dropoffLatitude != null && input.dropoffLongitude != null
        ? `${input.notes ? `${input.notes}\n` : ""}[coords] lat=${input.dropoffLatitude.toFixed(6)}, lng=${input.dropoffLongitude.toFixed(6)}`
        : input.notes;

    const order = await orderRepository.create({
      orderNumber: generateOrderNumber(),
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      store: { connect: { id: resolvedStoreId } },
      pickupAddress: input.pickupAddress,
      dropoffAddress: input.dropoffAddress,
      area: input.area,
      amount: new Prisma.Decimal(input.amount),
      cashCollection: new Prisma.Decimal(input.cashCollection ?? 0),
      notes: notesWithCoords,
      status: OrderStatus.PENDING,
      distributionMode: input.distributionMode ?? DistributionMode.AUTO,
      createdBy: { connect: { id: actor.userId } },
    });

    await activityService.log(actor.userId, "ORDER_CREATED", "order", order.id, {});
    return order;
  },

  async list(
    params: {
      storeId?: string;
      status?: OrderStatus;
      area?: string;
      orderNumber?: string;
      customerPhone?: string;
      page: number;
      pageSize: number;
    },
    actor: { role: string; storeId: string | null },
  ) {
    const filters = { ...params };
    if (actor.role === "STORE") {
      if (!actor.storeId) throw new AppError(400, "Store scope missing", "BAD_REQUEST");
      filters.storeId = actor.storeId;
    }
    const [total, items] = await orderRepository.list(filters);
    return { total, items };
  },

  async getById(id: string, actor: { role: string; userId: string; storeId: string | null }) {
    const order = await orderRepository.findById(id);
    if (!order) throw new AppError(404, "Order not found", "NOT_FOUND");
    if (actor.role === "STORE" && order.storeId !== actor.storeId) {
      throw new AppError(403, "Forbidden", "FORBIDDEN");
    }
    if (actor.role === "CAPTAIN") {
      const cap = await captainRepository.findByUserId(actor.userId);
      if (!cap) throw new AppError(403, "Forbidden", "FORBIDDEN");
      const allowed =
        order.assignedCaptainId === cap.id || order.assignmentLogs.some((l) => l.captainId === cap.id);
      if (!allowed) throw new AppError(403, "Forbidden", "FORBIDDEN");
    }
    return order;
  },

  async updateStatus(
    id: string,
    status: OrderStatus,
    actor: { userId: string; role: string; storeId: string | null },
  ) {
    const { userId: actorUserId, role: actorRole, storeId: actorStoreId } = actor;
    if (!["ADMIN", "DISPATCHER", "STORE", "CAPTAIN"].includes(actorRole)) {
      throw new AppError(403, "Forbidden", "FORBIDDEN");
    }
    const existing = await orderRepository.findById(id);
    if (!existing) throw new AppError(404, "Order not found", "NOT_FOUND");

    if (actorRole === "STORE") {
      if (!actorStoreId || existing.storeId !== actorStoreId) {
        throw new AppError(403, "Forbidden", "FORBIDDEN");
      }
    }

    if (actorRole === "CAPTAIN") {
      const captain = await captainRepository.findByUserId(actorUserId);
      if (!captain) throw new AppError(403, "Forbidden", "FORBIDDEN");
      if (existing.assignedCaptainId !== captain.id) {
        throw new AppError(403, "Only the assigned captain can update delivery status", "FORBIDDEN");
      }
      assertCaptainOrderStatusTransition(existing.status, status);
    }

    if (existing.status === status) return existing;

    const order = await orderRepository.update(id, { status });
    await activityService.log(actorUserId, "ORDER_STATUS_CHANGED", "order", id, { status });
    emitDispatcherOrderUpdated(order);
    if (order.assignedCaptain?.userId) {
      emitCaptainOrderUpdated(order.assignedCaptain.userId, order);
    }
    return order;
  },

  async acceptByCaptain(orderId: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      const captain = await tx.captain.findUnique({ where: { userId } });
      if (!captain) throw new AppError(404, "Captain profile not found", "NOT_FOUND");

      const log = await tx.orderAssignmentLog.findFirst({
        where: { orderId, captainId: captain.id, responseStatus: "PENDING" },
      });
      if (!log) throw new AppError(409, "No pending assignment", "INVALID_STATE");

      await tx.orderAssignmentLog.update({
        where: { id: log.id },
        data: { responseStatus: "ACCEPTED" },
      });

      await tx.orderAssignmentLog.updateMany({
        where: { orderId, responseStatus: "PENDING", id: { not: log.id } },
        data: { responseStatus: "CANCELLED", notes: "Another captain accepted" },
      });

      const order = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.ACCEPTED, assignedCaptainId: captain.id },
        include: {
          assignmentLogs: { orderBy: { assignedAt: "desc" }, take: 15 },
          store: true,
          assignedCaptain: true,
        },
      });

      await activityService.logTx(tx, userId, "ORDER_ACCEPTED_BY_CAPTAIN", "order", orderId, {});
      return order;
    }).then((order) => {
      emitDispatcherOrderUpdated(order);
      emitCaptainOrderUpdated(userId, order);
      return order;
    });
  },

  async rejectByCaptain(orderId: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      const captain = await tx.captain.findUnique({ where: { userId } });
      if (!captain) throw new AppError(404, "Captain profile not found", "NOT_FOUND");

      const log = await tx.orderAssignmentLog.findFirst({
        where: { orderId, captainId: captain.id, responseStatus: "PENDING" },
      });
      if (!log) throw new AppError(409, "No pending assignment", "INVALID_STATE");

      await tx.orderAssignmentLog.update({
        where: { id: log.id },
        data: { responseStatus: "REJECTED" },
      });

      await distributionService.afterCaptainRejectTx(tx, orderId, userId);

      await activityService.logTx(tx, userId, "ORDER_REJECTED_BY_CAPTAIN", "order", orderId, {});

      return tx.order.findUnique({
        where: { id: orderId },
        include: {
          assignmentLogs: { orderBy: { assignedAt: "desc" }, take: 15 },
          assignedCaptain: true,
          store: true,
        },
      });
    }).then((order) => {
      if (order) emitDispatcherOrderUpdated(order);
      emitCaptainAssignmentEnded(userId, { orderId, reason: "REJECTED" });
      return order;
    });
  },
};
