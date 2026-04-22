import { AssignmentResponseStatus, DistributionMode, OrderStatus, Prisma, UserRole } from "@prisma/client";
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
import { CAPTAIN_SOCKET_EVENTS } from "../realtime/captain-events.js";
import { emitToCaptain } from "../realtime/hub.js";
import { clampOfferExpiredAtToConfiguredWindow } from "./distribution/clamp-offer-expired-at.js";
import { DISTRIBUTION_TIMEOUT_SECONDS } from "./distribution/constants.js";
import { lockOrderDistributionTx } from "./distribution/order-lock.js";
import { logCaptainOrderResponse } from "./captain-order-response-log.js";
import { resolveOrderCustomerUserId } from "./order-customer-link.js";
import { notificationService } from "./notifications.service.js";

function decAmount(v: Prisma.Decimal | null | undefined): string {
  if (v == null) return "0";
  return v.toString();
}

/** ISO expiry for active captain offer — aligned with mobile `log.expiresAt` (clamped window). */
function pendingOfferExpiresAtIsoForListItem(order: {
  status: OrderStatus;
  assignedCaptainId: string | null;
  assignmentLogs?: Array<{
    captainId: string;
    assignedAt: Date;
    expiredAt: Date | null;
    responseStatus: AssignmentResponseStatus;
  }>;
}): string | null {
  if (order.status !== OrderStatus.ASSIGNED || !order.assignedCaptainId) return null;
  const log = order.assignmentLogs?.find(
    (l) =>
      l.responseStatus === AssignmentResponseStatus.PENDING &&
      l.captainId === order.assignedCaptainId &&
      l.expiredAt != null,
  );
  if (!log) return null;
  const expAt = log.expiredAt;
  if (!expAt) return null;
  const clamped = clampOfferExpiredAtToConfiguredWindow(log.assignedAt, expAt);
  return clamped ? clamped.toISOString() : null;
}

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
      /** اختياري — ربط صريح بحساب عميل؛ وإلا يُستنتج من تطابق الهاتف */
      customerUserId?: string;
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

    const linkedCustomerUserId = await resolveOrderCustomerUserId({
      explicitCustomerUserId: input.customerUserId ?? null,
      customerPhone: input.customerPhone,
    });

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
      ...(linkedCustomerUserId ? { customerUser: { connect: { id: linkedCustomerUserId } } } : {}),
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
    return {
      total,
      items: items.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        distributionMode: o.distributionMode,
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        pickupAddress: o.pickupAddress,
        dropoffAddress: o.dropoffAddress,
        area: o.area,
        amount: decAmount(o.amount),
        cashCollection: decAmount(o.cashCollection),
        notes: o.notes,
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
        store: o.store,
        assignedCaptain: o.assignedCaptain
          ? {
              id: o.assignedCaptain.id,
              user: {
                fullName: o.assignedCaptain.user.fullName,
                phone: o.assignedCaptain.user.phone,
              },
            }
          : null,
        pendingOfferExpiresAt: pendingOfferExpiresAtIsoForListItem(o),
      })),
    };
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
    logCaptainOrderResponse("ACCEPT_REQUEST", { orderId, userId });
    return prisma.$transaction(async (tx) => {
      const captain = await tx.captain.findUnique({ where: { userId } });
      if (!captain) throw new AppError(404, "Captain profile not found", "NOT_FOUND");

      const orderRow = await tx.order.findUnique({
        where: { id: orderId },
        select: { id: true, status: true, assignedCaptainId: true },
      });
      if (!orderRow) throw new AppError(404, "Order not found", "NOT_FOUND");

      const log = await tx.orderAssignmentLog.findFirst({
        where: { orderId, captainId: captain.id, responseStatus: "PENDING" },
      });

      if (!log) {
        const pendingAny = await tx.orderAssignmentLog.findMany({
          where: { orderId, responseStatus: "PENDING" },
          select: { id: true, captainId: true, expiredAt: true },
        });
        logCaptainOrderResponse("ACCEPT_REJECT_NO_PENDING_LOG", {
          orderId,
          captainId: captain.id,
          orderStatus: orderRow.status,
          orderAssignedCaptainId: orderRow.assignedCaptainId,
          otherPendingLogs: pendingAny.length,
        });
        throw new AppError(409, "No pending assignment", "INVALID_STATE");
      }

      if (orderRow.assignedCaptainId !== captain.id) {
        logCaptainOrderResponse("ACCEPT_REJECT_ASSIGNEE_MISMATCH", {
          orderId,
          captainId: captain.id,
          orderAssignedCaptainId: orderRow.assignedCaptainId,
          pendingLogId: log.id,
        });
        throw new AppError(409, "No pending assignment", "INVALID_STATE");
      }

      if (log.expiredAt && log.expiredAt.getTime() <= Date.now()) {
        logCaptainOrderResponse("ACCEPT_REJECT_LOG_EXPIRED", {
          orderId,
          captainId: captain.id,
          logId: log.id,
          expiredAtIso: log.expiredAt.toISOString(),
        });
        throw new AppError(409, "Offer has expired", "OFFER_EXPIRED");
      }

      logCaptainOrderResponse("ACCEPT_OK_PENDING_LOG", {
        orderId,
        captainId: captain.id,
        logId: log.id,
        orderStatus: orderRow.status,
      });

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
      logCaptainOrderResponse("ACCEPT_SUCCESS", { orderId, orderNumber: order.orderNumber, status: order.status });
      emitDispatcherOrderUpdated(order);
      emitCaptainOrderUpdated(userId, order);
      return order;
    });
  },

  async rejectByCaptain(orderId: string, userId: string) {
    logCaptainOrderResponse("REJECT_REQUEST", { orderId, userId });
    return prisma.$transaction(async (tx) => {
      const captain = await tx.captain.findUnique({ where: { userId } });
      if (!captain) throw new AppError(404, "Captain profile not found", "NOT_FOUND");

      const orderRow = await tx.order.findUnique({
        where: { id: orderId },
        select: { id: true, status: true, assignedCaptainId: true },
      });
      if (!orderRow) throw new AppError(404, "Order not found", "NOT_FOUND");

      const log = await tx.orderAssignmentLog.findFirst({
        where: { orderId, captainId: captain.id, responseStatus: "PENDING" },
      });
      if (!log) {
        logCaptainOrderResponse("REJECT_REJECT_NO_PENDING_LOG", {
          orderId,
          captainId: captain.id,
          orderStatus: orderRow.status,
          orderAssignedCaptainId: orderRow.assignedCaptainId,
        });
        throw new AppError(409, "No pending assignment", "INVALID_STATE");
      }

      if (orderRow.assignedCaptainId !== captain.id) {
        logCaptainOrderResponse("REJECT_REJECT_ASSIGNEE_MISMATCH", {
          orderId,
          captainId: captain.id,
          orderAssignedCaptainId: orderRow.assignedCaptainId,
          pendingLogId: log.id,
        });
        throw new AppError(409, "No pending assignment", "INVALID_STATE");
      }

      if (log.expiredAt && log.expiredAt.getTime() <= Date.now()) {
        logCaptainOrderResponse("REJECT_REJECT_LOG_EXPIRED", {
          orderId,
          captainId: captain.id,
          logId: log.id,
          expiredAtIso: log.expiredAt.toISOString(),
        });
        throw new AppError(409, "Offer has expired", "OFFER_EXPIRED");
      }

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
      logCaptainOrderResponse("REJECT_SUCCESS", {
        orderId,
        orderNumber: order?.orderNumber ?? null,
        status: order?.status ?? null,
      });
      if (order) emitDispatcherOrderUpdated(order);
      emitCaptainAssignmentEnded(userId, { orderId, reason: "REJECTED" });
      /**
       * بعد الرفض، مسار AUTO قد يعرض الطلب على كابتن آخر داخل نفس المعاملة — يجب بث `captain:assignment`
       * مثل `distributionService.startAuto` وإلا يعتمد الكابتن على الاستطلاع/الإشعارات فقط (تأخير واضح).
       */
      const nextCaptainUserId = order?.assignedCaptain?.userId;
      if (
        order?.status === OrderStatus.ASSIGNED &&
        nextCaptainUserId &&
        nextCaptainUserId !== userId
      ) {
        logCaptainOrderResponse("REJECT_EMIT_NEXT_OFFER", { orderId, nextCaptainUserId });
        emitToCaptain(nextCaptainUserId, CAPTAIN_SOCKET_EVENTS.ASSIGNMENT, {
          kind: "OFFER",
          orderId: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          timeoutSeconds: DISTRIBUTION_TIMEOUT_SECONDS,
        });
        emitCaptainOrderUpdated(nextCaptainUserId, order);
      }
      return order;
    });
  },

  async listForCustomer(
    customerUserId: string,
    params: { page: number; pageSize: number },
  ) {
    const user = await prisma.user.findUnique({ where: { id: customerUserId } });
    if (!user || user.role !== UserRole.CUSTOMER) {
      throw new AppError(403, "Forbidden", "FORBIDDEN");
    }
    const [total, items] = await orderRepository.listForCustomerAccount({
      customerUserId,
      page: params.page,
      pageSize: params.pageSize,
    });
    return {
      total,
      items: items.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        distributionMode: o.distributionMode,
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        pickupAddress: o.pickupAddress,
        dropoffAddress: o.dropoffAddress,
        area: o.area,
        amount: decAmount(o.amount),
        cashCollection: decAmount(o.cashCollection),
        notes: o.notes,
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
        store: o.store,
        assignedCaptain: o.assignedCaptain
          ? {
              id: o.assignedCaptain.id,
              user: {
                fullName: o.assignedCaptain.user.fullName,
                phone: o.assignedCaptain.user.phone,
              },
            }
          : null,
        pendingOfferExpiresAt: pendingOfferExpiresAtIsoForListItem(o),
        archivedAt: o.archivedAt?.toISOString() ?? null,
      })),
    };
  },

  /**
   * تعديل حالة الطلب من لوحة الإشراف — يلغي العروض PENDING ويفصل الكابتن عند العودة إلى PENDING/CONFIRMED/CANCELLED.
   * لا يستخدم لـ ASSIGNED (استخدم التوزيع) ولا لسلسلة التوصيل (الكابتن).
   */
  async adminOverrideOrderStatus(
    orderId: string,
    targetStatus: OrderStatus,
    actor: { userId: string; role: string },
  ) {
    if (actor.role !== "ADMIN" && actor.role !== "DISPATCHER") {
      throw new AppError(403, "Forbidden", "FORBIDDEN");
    }

    const allowed: OrderStatus[] = [
      OrderStatus.PENDING,
      OrderStatus.CONFIRMED,
      OrderStatus.CANCELLED,
      OrderStatus.DELIVERED,
    ];
    if (!allowed.includes(targetStatus)) {
      throw new AppError(400, "حالة غير مسموحة لهذا المسار الإشرافي", "INVALID_ADMIN_STATUS");
    }

    const quick = await prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true, archivedAt: true },
    });
    if (!quick) throw new AppError(404, "Order not found", "NOT_FOUND");
    if (quick.archivedAt) {
      throw new AppError(409, "ألغِ أرشفة الطلب قبل تعديل الحالة", "ORDER_ARCHIVED");
    }
    if (quick.status === targetStatus) {
      const unchanged = await orderRepository.findById(orderId);
      if (!unchanged) throw new AppError(500, "Order load failed", "INTERNAL");
      return unchanged;
    }

    let releasedCaptainUserId: string | null = null;

    await prisma.$transaction(async (tx) => {
      await lockOrderDistributionTx(tx, orderId);
      const before = await tx.order.findUnique({
        where: { id: orderId },
        include: { assignedCaptain: { include: { user: { select: { id: true } } } } },
      });
      if (!before) throw new AppError(404, "Order not found", "NOT_FOUND");
      if (before.archivedAt) {
        throw new AppError(409, "ألغِ أرشفة الطلب قبل تعديل الحالة", "ORDER_ARCHIVED");
      }
      if (before.status === targetStatus) {
        return;
      }

      await tx.orderAssignmentLog.updateMany({
        where: { orderId, responseStatus: AssignmentResponseStatus.PENDING },
        data: {
          responseStatus: AssignmentResponseStatus.CANCELLED,
          notes: "Cancelled: admin manual status override",
        },
      });

      const clearCaptain =
        targetStatus === OrderStatus.PENDING ||
        targetStatus === OrderStatus.CONFIRMED ||
        targetStatus === OrderStatus.CANCELLED;

      const prevCaptainUserId = before.assignedCaptain?.user?.id ?? null;
      if (clearCaptain && prevCaptainUserId) {
        releasedCaptainUserId = prevCaptainUserId;
      }

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: targetStatus,
          ...(clearCaptain ? { assignedCaptainId: null } : {}),
          ...(targetStatus === OrderStatus.PENDING ? { distributionMode: DistributionMode.AUTO } : {}),
        },
      });

      await activityService.logTx(tx, actor.userId, "ORDER_ADMIN_STATUS_OVERRIDE", "order", orderId, {
        from: before.status,
        to: targetStatus,
      });

      if (clearCaptain && prevCaptainUserId) {
        await notificationService.notifyCaptainTx(
          tx,
          prevCaptainUserId,
          "ORDER_ADMIN_RESET",
          "تحديث الطلب من التوزيع",
          `تم تعديل حالة الطلب ${before.orderNumber} من لوحة الإشراف — قد لا يعود مُسنداً إليك.`,
        );
      }
    });

    const order = await orderRepository.findById(orderId);
    if (!order) throw new AppError(500, "Order update failed", "INTERNAL");

    if (releasedCaptainUserId) {
      emitCaptainAssignmentEnded(releasedCaptainUserId, { orderId, reason: "ADMIN_STATUS_OVERRIDE" });
    }
    emitDispatcherOrderUpdated(order);
    const capUserId = order.assignedCaptain?.user?.id;
    if (capUserId) emitCaptainOrderUpdated(capUserId, order);
    return order;
  },

  async archiveOrder(orderId: string, actor: { userId: string; role: string }) {
    if (actor.role !== "ADMIN" && actor.role !== "DISPATCHER") {
      throw new AppError(403, "Forbidden", "FORBIDDEN");
    }
    const existing = await orderRepository.findById(orderId);
    if (!existing) throw new AppError(404, "Order not found", "NOT_FOUND");
    if (existing.archivedAt) {
      throw new AppError(409, "الطلب مؤرشف مسبقاً", "ALREADY_ARCHIVED");
    }

    /** ممنوع أرشفة طلب قيد التنقل الفعلي؛ **مسموح** أرشفة بعد التسليم (DELIVERED) لإخفائه من التشغيل مع بقاء السجل. */
    const blocked: OrderStatus[] = [OrderStatus.ACCEPTED, OrderStatus.PICKED_UP, OrderStatus.IN_TRANSIT];
    if (blocked.includes(existing.status)) {
      throw new AppError(
        409,
        "لا يمكن أرشفة طلب قيد التنفيذ — غيّر الحالة أو انتظر الإكمال.",
        "ORDER_NOT_ARCHIVABLE",
      );
    }

    if (existing.assignedCaptainId && existing.status === OrderStatus.ASSIGNED) {
      await distributionService.cancelCaptainAssignment(orderId, actor.userId);
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { archivedAt: new Date() },
    });

    await activityService.log(actor.userId, "ORDER_ARCHIVED", "order", orderId, {});
    const archived = await orderRepository.findById(orderId);
    if (archived) emitDispatcherOrderUpdated(archived);
    return archived;
  },

  async unarchiveOrder(orderId: string, actor: { userId: string; role: string }) {
    if (actor.role !== "ADMIN" && actor.role !== "DISPATCHER") {
      throw new AppError(403, "Forbidden", "FORBIDDEN");
    }
    const existing = await orderRepository.findById(orderId);
    if (!existing) throw new AppError(404, "Order not found", "NOT_FOUND");
    if (!existing.archivedAt) {
      throw new AppError(409, "الطلب غير مؤرشف", "NOT_ARCHIVED");
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { archivedAt: null },
    });

    await activityService.log(actor.userId, "ORDER_UNARCHIVED", "order", orderId, {});
    const restored = await orderRepository.findById(orderId);
    if (restored) emitDispatcherOrderUpdated(restored);
    return restored;
  },
};
