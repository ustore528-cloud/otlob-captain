import { AssignmentResponseStatus, DistributionMode, OrderStatus, Prisma, UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { orderRepository } from "../repositories/order.repository.js";
import { captainRepository } from "../repositories/captain.repository.js";
import { AppError } from "../utils/errors.js";
import { generateOrderNumber } from "../utils/order-number.js";
import { activityService } from "./activity.service.js";
import { distributionService } from "./distribution/index.js";
import { assertCaptainOrderStatusTransition } from "../domain/order-captain-status.js";
import { patchOrderStatusTransitionTimestamps } from "../domain/order-status-timestamps.js";
import { orderStoreInclude } from "../repositories/order-store-enrichment.js";
import {
  emitCaptainAssignmentEnded,
  emitCaptainOrderUpdated,
  emitDispatcherOrderUpdated,
} from "../realtime/order-emits.js";
import { CAPTAIN_SOCKET_EVENTS } from "../realtime/captain-events.js";
import { emitToCaptain } from "../realtime/hub.js";
import { DISTRIBUTION_TIMEOUT_SECONDS } from "./distribution/constants.js";
import { lockOrderDistributionTx } from "./distribution/order-lock.js";
import { logCaptainOrderResponse } from "./captain-order-response-log.js";
import { resolveOrderCustomerUserId } from "./order-customer-link.js";
import { notificationService } from "./notifications.service.js";
import { pushNotificationService } from "./push-notification.service.js";
import { ORDER_DELIVERED_LEDGER_HOOK_ENABLED, ORDER_STATUS_TX_OPTIONS } from "../config/order-ledger-flags.js";
import { captainPrepaidBalanceService } from "./captain-prepaid-balance.service.js";
import { applyDeliveredOrderLedgerTx } from "./order-delivered-ledger.service.js";
import {
  assertOrderAndCaptainSameCompany,
  assertStaffCanAccessOrder,
  resolveStaffTenantOrderListFilter,
} from "./tenant-scope.service.js";
import { resolveOrCreateOperationalStoreId } from "./operational-store.service.js";
import { assertSupervisorReadAccessForOrder, resolveSupervisorReadScopeForList } from "../lib/supervisor-order-read-scope.js";
import {
  isCaptainRole,
  isOrderOperatorRole,
  isStoreAdminRole,
  isSupportedPlatformActorRole,
  type AppRole,
} from "../lib/rbac-roles.js";
import { resolveCanonicalOrderMoneyOnCreate } from "../domain/order-canonical-money.js";
import { toOrderDetailDto, toOrderListItemDto } from "../dto/order.dto.js";

function decAmount(v: Prisma.Decimal | null | undefined): string {
  if (v == null) return "0";
  return v.toString();
}

function orderAccessScope(order: {
  companyId: string;
  branchId: string;
  ownerUserId?: string | null;
  createdByUserId?: string | null;
  assignedCaptain?: { createdByUserId?: string | null } | null;
}) {
  return {
    companyId: order.companyId,
    branchId: order.branchId,
    ownerUserId: order.ownerUserId ?? null,
    createdByUserId: order.createdByUserId ?? null,
    assignedCaptain: order.assignedCaptain
      ? { createdByUserId: order.assignedCaptain.createdByUserId ?? null }
      : null,
  };
}

export const ordersService = {
  async create(
    input: {
      storeId?: string;
      /**
       * Frontend-provided tenant fields are ignored; tenant is always derived from store.
       * Kept here to harden against injected payloads from older/newer clients.
       */
      companyId?: string;
      branchId?: string;
      customerName: string;
      customerPhone: string;
      pickupAddress: string;
      dropoffAddress: string;
      area: string;
      amount: number;
      cashCollection?: number;
      pickupLatitude?: number;
      pickupLongitude?: number;
      dropoffLatitude?: number;
      dropoffLongitude?: number;
      deliveryFee?: number;
      notes?: string;
      distributionMode?: "AUTO" | "MANUAL";
      /** اختياري — ربط صريح بحساب عميل؛ وإلا يُستنتج من تطابق الهاتف */
      customerUserId?: string;
      /** منطقة اختيارية (ضمن شركة المتجر) — لا توسّع نطاق الأمان */
      zoneId?: string;
      /** رمز تتبّع عميل صفحة الطلب العام فقط */
      publicTrackingToken?: string;
    },
    actor: {
      userId: string;
      role: AppRole;
      storeId: string | null;
      companyId: string | null;
      branchId: string | null;
    },
  ) {
    let resolvedStoreId = input.storeId;
    const staffTenant =
      isOrderOperatorRole(actor.role)
        ? await resolveStaffTenantOrderListFilter({
            userId: actor.userId,
            role: actor.role,
            companyId: actor.companyId ?? null,
            branchId: actor.branchId ?? null,
          })
        : null;

    if (isStoreAdminRole(actor.role)) {
      if (!actor.storeId || (resolvedStoreId && resolvedStoreId !== actor.storeId)) {
        throw new AppError(403, "Cannot create order for another store", "FORBIDDEN");
      }
      resolvedStoreId = actor.storeId;
    }

    if (!resolvedStoreId && isOrderOperatorRole(actor.role)) {
      if (staffTenant?.companyId) {
        resolvedStoreId = await resolveOrCreateOperationalStoreId({
          companyId: staffTenant.companyId,
          branchIdFilter: staffTenant.branchId ?? null,
          ownerUserId: actor.userId,
        });
      } else {
        // Super Admin (or unscoped legacy): keep historical behavior — any active store, oldest first
        const existing = await prisma.store.findFirst({
          where: { isActive: true },
          orderBy: { createdAt: "asc" },
        });
        if (existing) {
          resolvedStoreId = existing.id;
        } else {
          throw new AppError(400, "storeId is required", "BAD_REQUEST");
        }
      }
    }

    if (!resolvedStoreId) {
      throw new AppError(400, "storeId is required", "BAD_REQUEST");
    }

    const store = await prisma.store.findUnique({
      where: { id: resolvedStoreId },
      include: { branch: { select: { companyId: true } } },
    });
    if (!store?.isActive) throw new AppError(400, "Store not found or inactive", "BAD_REQUEST");
    if (store.branch.companyId !== store.companyId) {
      throw new AppError(500, "Store tenant linkage is inconsistent", "INTERNAL");
    }
    if (
      staffTenant?.companyId &&
      (store.companyId !== staffTenant.companyId || (staffTenant.branchId && store.branchId !== staffTenant.branchId))
    ) {
      throw new AppError(403, "Cannot create order for another company or branch", "FORBIDDEN");
    }

    const linkedCustomerUserId = await resolveOrderCustomerUserId({
      explicitCustomerUserId: input.customerUserId ?? null,
      customerPhone: input.customerPhone,
    });

    let zoneConnect: { connect: { id: string } } | undefined;
    if (input.zoneId) {
      const z = await prisma.zone.findFirst({
        where: { id: input.zoneId, isActive: true, city: { companyId: store.companyId } },
        select: { id: true },
      });
      if (!z) throw new AppError(400, "Invalid zone for this company.", "INVALID_ZONE");
      zoneConnect = { connect: { id: z.id } };
    }

    let ownerConnect: { connect: { id: string } } | undefined;
    let orderPublicOwnerCode: string | undefined;
    if (actor.role === UserRole.COMPANY_ADMIN) {
      ownerConnect = { connect: { id: actor.userId } };
      const u = await prisma.user.findUnique({
        where: { id: actor.userId },
        select: { publicOwnerCode: true },
      });
      orderPublicOwnerCode = u?.publicOwnerCode ?? undefined;
    }

    const resolvedMoney = resolveCanonicalOrderMoneyOnCreate({
      amount: input.amount,
      deliveryFee: input.deliveryFee,
      cashCollection: input.cashCollection,
    });

    const order = await orderRepository.createWithDisplaySequence(
      {
        orderNumber: generateOrderNumber(),
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        company: { connect: { id: store.companyId } },
        branch: { connect: { id: store.branchId } },
        store: { connect: { id: resolvedStoreId } },
        pickupAddress: input.pickupAddress,
        dropoffAddress: input.dropoffAddress,
        pickupLat: input.pickupLatitude ?? store.latitude ?? null,
        pickupLng: input.pickupLongitude ?? store.longitude ?? null,
        dropoffLat: input.dropoffLatitude ?? null,
        dropoffLng: input.dropoffLongitude ?? null,
        area: input.area,
        amount: resolvedMoney.amount,
        cashCollection: resolvedMoney.cashCollection,
        deliveryFee: resolvedMoney.deliveryFee,
        notes: input.notes ?? null,
        status: OrderStatus.PENDING,
        distributionMode: input.distributionMode ?? DistributionMode.AUTO,
        createdBy: { connect: { id: actor.userId } },
        ...(linkedCustomerUserId ? { customerUser: { connect: { id: linkedCustomerUserId } } } : {}),
        ...(ownerConnect ? { ownerUser: ownerConnect } : {}),
        ...(orderPublicOwnerCode ? { orderPublicOwnerCode } : {}),
        ...(zoneConnect ? { zone: zoneConnect } : {}),
        ...(input.publicTrackingToken ? { publicTrackingToken: input.publicTrackingToken } : {}),
      },
      store.companyId,
    );

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
    actor: {
      userId: string;
      role: AppRole;
      storeId: string | null;
      companyId: string | null;
      branchId: string | null;
    },
  ) {
    if (!isSupportedPlatformActorRole(actor.role)) {
      throw new AppError(
        403,
        "This role is not supported for listing orders.",
        "ROLE_NOT_SUPPORTED",
      );
    }

    const filters: Parameters<typeof orderRepository.list>[0] = { ...params };

    if (isCaptainRole(actor.role)) {
      const cap = await captainRepository.findByUserId(actor.userId);
      if (!cap) {
        throw new AppError(403, "Captain profile not found.", "FORBIDDEN");
      }
      filters.captainVisibilityScopeId = cap.id;
      const [total, items] = await orderRepository.list(filters);
      return {
        total,
        items: items.map((o) => toOrderListItemDto(o)),
      };
    }

    // SUPER_ADMIN + COMPANY_ADMIN: tenant-scoped operational list (empty scope for super-admin = global).
    if (!isOrderOperatorRole(actor.role)) {
      throw new AppError(403, "Forbidden", "FORBIDDEN");
    }
    const tenant = await resolveStaffTenantOrderListFilter({
      userId: actor.userId,
      role: actor.role,
      companyId: actor.companyId ?? null,
      branchId: actor.branchId ?? null,
    });
    if (tenant.companyId) filters.companyId = tenant.companyId;
    if (tenant.branchId) filters.branchId = tenant.branchId;
    const supRead = await resolveSupervisorReadScopeForList({
      userId: actor.userId,
      role: actor.role,
      companyId: actor.companyId ?? null,
      branchId: actor.branchId ?? null,
    });
    if (supRead) filters.supervisorReadOr = supRead;

    const [total, items] = await orderRepository.list(filters);
    return {
      total,
      items: items.map((o) => toOrderListItemDto(o)),
    };
  },

  async getById(
    id: string,
    actor: {
      role: AppRole;
      userId: string;
      storeId: string | null;
      companyId: string | null;
      branchId: string | null;
    },
  ) {
    const order = await orderRepository.findById(id);
    if (!order) throw new AppError(404, "Order not found", "NOT_FOUND");
    if (isStoreAdminRole(actor.role) && order.storeId !== actor.storeId) {
      throw new AppError(403, "Forbidden", "FORBIDDEN");
    }
    if (isOrderOperatorRole(actor.role)) {
      await assertStaffCanAccessOrder(
        {
          userId: actor.userId,
          role: actor.role,
          companyId: actor.companyId ?? null,
          branchId: actor.branchId ?? null,
        },
        orderAccessScope(order),
      );
      await assertSupervisorReadAccessForOrder(
        {
          userId: actor.userId,
          role: actor.role,
          companyId: actor.companyId ?? null,
          branchId: actor.branchId ?? null,
        },
        { storeId: order.storeId, assignedCaptainId: order.assignedCaptainId },
      );
    }
    if (isCaptainRole(actor.role)) {
      const cap = await captainRepository.findByUserId(actor.userId);
      if (!cap) throw new AppError(403, "Forbidden", "FORBIDDEN");
      assertOrderAndCaptainSameCompany(
        { companyId: order.companyId, branchId: order.branchId },
        { companyId: cap.companyId, branchId: cap.branchId },
      );
      const allowed =
        order.assignedCaptainId === cap.id || order.assignmentLogs.some((l) => l.captainId === cap.id);
      if (!allowed) throw new AppError(403, "Forbidden", "FORBIDDEN");
    }
    return toOrderDetailDto(order);
  },

  async updateStatus(
    id: string,
    status: OrderStatus,
    actor: {
      userId: string;
      role: AppRole;
      storeId: string | null;
      companyId: string | null;
      branchId: string | null;
    },
  ) {
    const { userId: actorUserId, role: actorRole, storeId: actorStoreId } = actor;
    if (!isOrderOperatorRole(actorRole) && !isStoreAdminRole(actorRole) && !isCaptainRole(actorRole)) {
      throw new AppError(403, "Forbidden", "FORBIDDEN");
    }
    const existing = await orderRepository.findById(id);
    if (!existing) throw new AppError(404, "Order not found", "NOT_FOUND");
    if (isOrderOperatorRole(actorRole)) {
      await assertStaffCanAccessOrder(
        {
          userId: actorUserId,
          role: actorRole,
          companyId: actor.companyId ?? null,
          branchId: actor.branchId ?? null,
        },
        orderAccessScope(existing),
      );
    }

    if (isStoreAdminRole(actorRole)) {
      if (!actorStoreId || existing.storeId !== actorStoreId) {
        throw new AppError(403, "Forbidden", "FORBIDDEN");
      }
    }

    if (isCaptainRole(actorRole)) {
      const captain = await captainRepository.findByUserId(actorUserId);
      if (!captain) throw new AppError(403, "Forbidden", "FORBIDDEN");
      assertOrderAndCaptainSameCompany(
        { companyId: existing.companyId, branchId: existing.branchId },
        { companyId: captain.companyId, branchId: captain.branchId },
      );
      const hasAssignmentHistory = existing.assignmentLogs.some((l) => l.captainId === captain.id);
      const isAssignedToMe = existing.assignedCaptainId === captain.id;
      if (!isAssignedToMe && !hasAssignmentHistory) {
        throw new AppError(403, "You are not associated with this order.", "FORBIDDEN");
      }
      if (!isAssignedToMe) {
        throw new AppError(
          403,
          "Only the assigned captain can update delivery status. Use accept or reject for open offers.",
          "CAPTAIN_NOT_ASSIGNED",
        );
      }
      assertCaptainOrderStatusTransition(existing.status, status);
    }

    if (existing.status === status) return existing;

    const order = await prisma.$transaction(
      async (tx) => {
        const snap = await tx.order.findUnique({
          where: { id },
          select: { pickedUpAt: true, deliveredAt: true },
        });
        if (!snap) throw new AppError(404, "Order not found", "NOT_FOUND");
        const timestampData = patchOrderStatusTransitionTimestamps(snap, status);
        const updated = await tx.order.update({
          where: { id },
          data: { status, ...timestampData },
          include: {
            assignmentLogs: { orderBy: { assignedAt: "desc" }, take: 15 },
            store: orderStoreInclude,
            assignedCaptain: true,
          },
        });
        if (status === OrderStatus.DELIVERED) {
          if (ORDER_DELIVERED_LEDGER_HOOK_ENABLED) {
            await applyDeliveredOrderLedgerTx(tx, id, actorUserId);
          } else {
            await captainPrepaidBalanceService.deductForDeliveredOrderTx(tx, id, actorUserId);
          }
        }
        await activityService.logTx(tx, actorUserId, "ORDER_STATUS_CHANGED", "order", id, { status });
        return updated;
      },
      ORDER_STATUS_TX_OPTIONS,
    );
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
        select: {
          id: true,
          status: true,
          assignedCaptainId: true,
          companyId: true,
          branchId: true,
        },
      });
      if (!orderRow) throw new AppError(404, "Order not found", "NOT_FOUND");

      assertOrderAndCaptainSameCompany(
        { companyId: orderRow.companyId, branchId: orderRow.branchId },
        { companyId: captain.companyId, branchId: captain.branchId },
      );

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
          store: orderStoreInclude,
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
        select: {
          id: true,
          status: true,
          assignedCaptainId: true,
          companyId: true,
          branchId: true,
        },
      });
      if (!orderRow) throw new AppError(404, "Order not found", "NOT_FOUND");

      assertOrderAndCaptainSameCompany(
        { companyId: orderRow.companyId, branchId: orderRow.branchId },
        { companyId: captain.companyId, branchId: captain.branchId },
      );

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
          store: orderStoreInclude,
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
        void pushNotificationService.sendCaptainOrderPush({
          userId: nextCaptainUserId,
          title: "ط·ظ„ط¨ ط¬ط¯ظٹط¯ ط¨ط§ظ†طھط¸ط§ط± ظ‚ط¨ظˆظ„ظƒ",
          body: `طھظ… ط¹ط±ط¶ ط§ظ„ط·ظ„ط¨ ${order.orderNumber} ط¹ظ„ظٹظƒ. ط§ط¶ط؛ط· ظ„ظ„ظ‚ط¨ظˆظ„ ط£ظˆ ط§ظ„ط±ظپط¶.`,
          orderId: order.id,
          orderNumber: order.orderNumber,
          kind: "OFFER",
          status: order.status,
        });
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
        ...toOrderListItemDto(o),
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
    actor: { userId: string; role: AppRole; companyId: string | null; branchId: string | null },
  ) {
    if (!isOrderOperatorRole(actor.role)) {
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
      select: {
        status: true,
        archivedAt: true,
        companyId: true,
        branchId: true,
        ownerUserId: true,
        createdByUserId: true,
        assignedCaptain: { select: { createdByUserId: true } },
      },
    });
    if (!quick) throw new AppError(404, "Order not found", "NOT_FOUND");
    await assertStaffCanAccessOrder(
      {
        userId: actor.userId,
        role: actor.role,
        companyId: actor.companyId ?? null,
        branchId: actor.branchId ?? null,
      },
      orderAccessScope({
        companyId: quick.companyId,
        branchId: quick.branchId,
        ownerUserId: quick.ownerUserId,
        createdByUserId: quick.createdByUserId,
        assignedCaptain: quick.assignedCaptain,
      }),
    );
    if (quick.archivedAt) {
      throw new AppError(409, "ألغِ أرشفة الطلب قبل تعديل الحالة", "ORDER_ARCHIVED");
    }
    if (quick.status === targetStatus) {
      const unchanged = await orderRepository.findById(orderId);
      if (!unchanged) throw new AppError(500, "Order load failed", "INTERNAL");
      return unchanged;
    }

    let releasedCaptainUserId: string | null = null;

    await prisma.$transaction(
      async (tx) => {
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

        const timestampData = patchOrderStatusTransitionTimestamps(
          { pickedUpAt: before.pickedUpAt, deliveredAt: before.deliveredAt },
          targetStatus,
        );
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: targetStatus,
            ...(clearCaptain ? { assignedCaptainId: null } : {}),
            ...(targetStatus === OrderStatus.PENDING ? { distributionMode: DistributionMode.AUTO } : {}),
            ...timestampData,
          },
        });

        if (targetStatus === OrderStatus.DELIVERED) {
          if (ORDER_DELIVERED_LEDGER_HOOK_ENABLED) {
            await applyDeliveredOrderLedgerTx(tx, orderId, actor.userId);
          } else {
            await captainPrepaidBalanceService.deductForDeliveredOrderTx(tx, orderId, actor.userId);
          }
        }

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
      },
      ORDER_STATUS_TX_OPTIONS,
    );

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

  async archiveOrder(orderId: string, actor: {
    userId: string;
    role: AppRole;
    companyId: string | null;
    branchId: string | null;
  }) {
    if (!isOrderOperatorRole(actor.role)) {
      throw new AppError(403, "Forbidden", "FORBIDDEN");
    }
    const existing = await orderRepository.findById(orderId);
    if (!existing) throw new AppError(404, "Order not found", "NOT_FOUND");
    await assertStaffCanAccessOrder(
      {
        userId: actor.userId,
        role: actor.role,
        companyId: actor.companyId ?? null,
        branchId: actor.branchId ?? null,
      },
      orderAccessScope(existing),
    );
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
      await distributionService.cancelCaptainAssignment(orderId, actor.userId, {
        userId: actor.userId,
        role: actor.role,
        companyId: actor.companyId ?? null,
        branchId: actor.branchId ?? null,
      });
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

  async unarchiveOrder(orderId: string, actor: {
    userId: string;
    role: AppRole;
    companyId: string | null;
    branchId: string | null;
  }) {
    if (!isOrderOperatorRole(actor.role)) {
      throw new AppError(403, "Forbidden", "FORBIDDEN");
    }
    const existing = await orderRepository.findById(orderId);
    if (!existing) throw new AppError(404, "Order not found", "NOT_FOUND");
    await assertStaffCanAccessOrder(
      {
        userId: actor.userId,
        role: actor.role,
        companyId: actor.companyId ?? null,
        branchId: actor.branchId ?? null,
      },
      orderAccessScope(existing),
    );
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
