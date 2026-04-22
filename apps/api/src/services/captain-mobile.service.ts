import {
  AssignmentResponseStatus,
  CaptainAvailabilityStatus,
  OrderStatus,
  type Prisma,
} from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { captainRepository } from "../repositories/captain.repository.js";
import { orderRepository } from "../repositories/order.repository.js";
import { buildPaginatedDto } from "../dto/pagination.dto.js";
import { toOrderDetailDto, toOrderListItemDto } from "../dto/order.dto.js";
import { AppError } from "../utils/errors.js";
import { authService } from "./auth.service.js";
import { captainsService } from "./captains.service.js";
import { ordersService } from "./orders.service.js";
import { trackingService } from "./tracking.service.js";
import { env } from "../config/env.js";
import { DISTRIBUTION_TIMEOUT_SECONDS } from "./distribution/constants.js";
import { clampOfferExpiredAtToConfiguredWindow } from "./distribution/clamp-offer-expired-at.js";
import { logOfferPayloadCaptainMobileDiagnostics } from "./distribution/offer-diagnostics.js";

/** @see ./distribution/assigned-order-semantics.ts — ASSIGNED vs OFFER vs ACTIVE (ACCEPTED+). */

/**
 * Live assignment snapshot for the captain app — **intentionally singular** (not a list).
 * At most one pending OFFER or one in-flight ACTIVE order; see `getCurrentAssignment`.
 */
export type CurrentAssignmentResponse =
  | { state: "NONE" }
  | {
      state: "OFFER";
      timeoutSeconds: number;
      log: { id: string; assignedAt: string; expiresAt: string | null };
      order: ReturnType<typeof toOrderDetailDto>;
    }
  | { state: "ACTIVE"; order: ReturnType<typeof toOrderDetailDto> };

/**
 * `GET /mobile/captain/me/assignment/overflow` — orders assignable or in-flight for this captain
 * that are **not** the primary snapshot from `getCurrentAssignment` (same selection rules).
 */
export type AssignmentOverflowItemDto = {
  orderId: string;
  orderNumber: string;
  kind: "OFFER" | "ACTIVE";
  status: OrderStatus;
  customerPhone: string;
  amount: string;
  cashCollection: string;
  pickupAddress: string;
  dropoffAddress: string;
  storeName: string;
  offerExpiresAt: string | null;
};

export type AssignmentOverflowResponse = {
  /** Same order as the singular `/me/assignment` payload when state ≠ NONE; else null. */
  primaryOrderId: string | null;
  items: AssignmentOverflowItemDto[];
};

/**
 * Captain current-working statuses for mobile current-orders.
 * ASSIGNED is intentionally excluded here; ASSIGNED offers are sourced from pending assignment logs.
 */
const CAPTAIN_CURRENT_WORKING_STATUSES: OrderStatus[] = [
  OrderStatus.ACCEPTED,
  OrderStatus.PICKED_UP,
  OrderStatus.IN_TRANSIT,
];

/** Mirrors `getCurrentAssignment` branch order — pending OFFER wins over newest ACTIVE-working order. */
async function resolvePrimaryAssignmentOrderId(captainId: string): Promise<string | null> {
  const now = new Date();
  const pendingLog = await prisma.orderAssignmentLog.findFirst({
    where: {
      captainId,
      responseStatus: AssignmentResponseStatus.PENDING,
      OR: [{ expiredAt: null }, { expiredAt: { gt: now } }],
      order: {
        assignedCaptainId: captainId,
        status: OrderStatus.ASSIGNED,
      },
    },
    orderBy: [{ expiredAt: "asc" }, { assignedAt: "desc" }],
    select: { orderId: true },
  });
  if (pendingLog) return pendingLog.orderId;

  const active = await prisma.order.findFirst({
    where: {
      assignedCaptainId: captainId,
      status: { in: CAPTAIN_CURRENT_WORKING_STATUSES },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  return active?.id ?? null;
}

export const captainMobileService = {
  login(input: { phone?: string; email?: string; password: string }) {
    return authService.loginCaptain(input);
  },

  refresh(refreshToken: string) {
    return authService.refresh(refreshToken);
  },

  async me(userId: string) {
    const captain = await captainRepository.findByUserId(userId);
    if (!captain) throw new AppError(404, "Captain profile not found", "NOT_FOUND");
    return {
      user: {
        id: captain.user.id,
        fullName: captain.user.fullName,
        phone: captain.user.phone,
        email: captain.user.email,
        isActive: captain.user.isActive,
      },
      captain: {
        id: captain.id,
        vehicleType: captain.vehicleType,
        area: captain.area,
        availabilityStatus: captain.availabilityStatus,
        isActive: captain.isActive,
        lastSeenAt: captain.lastSeenAt?.toISOString() ?? null,
      },
    };
  },

  /**
   * `GET /mobile/captain/me/assignment` — **one live snapshot only** (`findFirst` per branch):
   * pending OFFER (soonest-expiring log) or newest ACTIVE-working row, or NONE.
   * Not a multi-order queue; a contract change is required to expose concurrent live orders.
   */
  async getCurrentAssignment(userId: string): Promise<CurrentAssignmentResponse> {
    const captain = await captainRepository.findByUserId(userId);
    if (!captain) throw new AppError(404, "Captain profile not found", "NOT_FOUND");

    /** يجب أن يكون الطلب مُسندًا لهذا الكابتن، وأن لا يكون انتهاء العرض قد مرّ (قبل أن يعالجها worker التوزيع) */
    const now = new Date();
    const pendingLog = await prisma.orderAssignmentLog.findFirst({
      where: {
        captainId: captain.id,
        responseStatus: AssignmentResponseStatus.PENDING,
        OR: [{ expiredAt: null }, { expiredAt: { gt: now } }],
        order: {
          assignedCaptainId: captain.id,
          status: OrderStatus.ASSIGNED,
        },
      },
      /** أقرب `expiredAt` أولاً — يطابق خريطة التتبع (`assignmentOfferExpiresAt` = أقل مهلة بين العروض المعلقة) */
      orderBy: [{ expiredAt: "asc" }, { assignedAt: "desc" }],
      include: {
        order: {
          include: {
            store: true,
            assignmentLogs: { orderBy: { assignedAt: "desc" }, take: 20 },
          },
        },
      },
    });

    if (pendingLog?.order) {
      const expiresAtClamped = clampOfferExpiredAtToConfiguredWindow(
        pendingLog.assignedAt,
        pendingLog.expiredAt,
      );
      if (env.OFFER_DIAGNOSTICS === "1") {
        logOfferPayloadCaptainMobileDiagnostics({
          orderId: pendingLog.orderId,
          captainId: captain.id,
          assignedAtIso: pendingLog.assignedAt.toISOString(),
          expiresAtIso: expiresAtClamped ? expiresAtClamped.toISOString() : null,
        });
      }
      return {
        state: "OFFER",
        timeoutSeconds: DISTRIBUTION_TIMEOUT_SECONDS,
        log: {
          id: pendingLog.id,
          assignedAt: pendingLog.assignedAt.toISOString(),
          expiresAt: expiresAtClamped ? expiresAtClamped.toISOString() : null,
        },
        order: toOrderDetailDto(pendingLog.order),
      };
    }

    const active = await prisma.order.findFirst({
      where: {
        assignedCaptainId: captain.id,
        status: { in: CAPTAIN_CURRENT_WORKING_STATUSES },
      },
      orderBy: { updatedAt: "desc" },
      include: {
        store: true,
        assignmentLogs: { orderBy: { assignedAt: "desc" }, take: 20 },
      },
    });

    if (active) return { state: "ACTIVE", order: toOrderDetailDto(active) };

    return { state: "NONE" };
  },

  /**
   * Secondary concurrent offers / active-working orders hidden from the singular `/me/assignment` card.
   * Default AUTO distribution policy remains single-order; concurrent rows here are explicit exceptional paths.
   * Uses the same primary key as `getCurrentAssignment` via `resolvePrimaryAssignmentOrderId`.
   */
  async getAssignmentOverflow(userId: string): Promise<AssignmentOverflowResponse> {
    const captain = await captainRepository.findByUserId(userId);
    if (!captain) throw new AppError(404, "Captain profile not found", "NOT_FOUND");

    const primaryOrderId = await resolvePrimaryAssignmentOrderId(captain.id);
    const now = new Date();

    const [pendingLogs, activeOrders] = await Promise.all([
      prisma.orderAssignmentLog.findMany({
        where: {
          captainId: captain.id,
          responseStatus: AssignmentResponseStatus.PENDING,
          OR: [{ expiredAt: null }, { expiredAt: { gt: now } }],
          order: {
            assignedCaptainId: captain.id,
            status: OrderStatus.ASSIGNED,
          },
        },
        orderBy: [{ expiredAt: "asc" }, { assignedAt: "desc" }],
        select: {
          assignedAt: true,
          expiredAt: true,
          orderId: true,
          order: {
            select: {
              orderNumber: true,
              status: true,
              customerPhone: true,
              amount: true,
              cashCollection: true,
              pickupAddress: true,
              dropoffAddress: true,
              store: { select: { name: true } },
            },
          },
        },
      }),
      prisma.order.findMany({
        where: {
          assignedCaptainId: captain.id,
          status: { in: CAPTAIN_CURRENT_WORKING_STATUSES },
        },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          customerPhone: true,
          amount: true,
          cashCollection: true,
          pickupAddress: true,
          dropoffAddress: true,
          store: { select: { name: true } },
        },
      }),
    ]);

    const items: AssignmentOverflowItemDto[] = [];
    const seen = new Set<string>();
    const primaryOrderIdNormalized = primaryOrderId ? String(primaryOrderId).trim() : null;

    for (const log of pendingLogs) {
      const orderId = String(log.orderId ?? "").trim();
      if (!orderId) continue;
      if (orderId === primaryOrderIdNormalized) continue;
      if (seen.has(orderId)) continue;
      seen.add(orderId);
      const clamped = clampOfferExpiredAtToConfiguredWindow(log.assignedAt, log.expiredAt);
      items.push({
        orderId,
        orderNumber: log.order.orderNumber,
        kind: "OFFER",
        status: log.order.status,
        customerPhone: log.order.customerPhone,
        amount: log.order.amount.toString(),
        cashCollection: log.order.cashCollection.toString(),
        pickupAddress: log.order.pickupAddress,
        dropoffAddress: log.order.dropoffAddress,
        storeName: log.order.store.name,
        offerExpiresAt: clamped ? clamped.toISOString() : null,
      });
    }

    for (const o of activeOrders) {
      const orderId = String(o.id ?? "").trim();
      if (!orderId) continue;
      if (orderId === primaryOrderIdNormalized) continue;
      if (seen.has(orderId)) continue;
      seen.add(orderId);
      items.push({
        orderId,
        orderNumber: o.orderNumber,
        kind: "ACTIVE",
        status: o.status,
        customerPhone: o.customerPhone,
        amount: o.amount.toString(),
        cashCollection: o.cashCollection.toString(),
        pickupAddress: o.pickupAddress,
        dropoffAddress: o.dropoffAddress,
        storeName: o.store.name,
        offerExpiresAt: null,
      });
    }

    return { primaryOrderId: primaryOrderIdNormalized, items };
  },

  async getOrderById(userId: string, orderId: string) {
    const order = await ordersService.getById(orderId, {
      role: "CAPTAIN",
      userId,
      storeId: null,
    });
    return toOrderDetailDto(order);
  },

  async updateAvailability(userId: string, availabilityStatus: CaptainAvailabilityStatus) {
    const captain = await captainRepository.findByUserId(userId);
    if (!captain) throw new AppError(404, "Captain profile not found", "NOT_FOUND");
    const updated = await captainsService.setAvailability(
      captain.id,
      userId,
      availabilityStatus,
      userId,
      { role: "CAPTAIN" },
    );
    return {
      captain: {
        id: updated.id,
        availabilityStatus: updated.availabilityStatus,
        lastSeenAt: updated.lastSeenAt?.toISOString() ?? null,
      },
    };
  },

  acceptOrder(orderId: string, userId: string) {
    return ordersService.acceptByCaptain(orderId, userId);
  },

  rejectOrder(orderId: string, userId: string) {
    return ordersService.rejectByCaptain(orderId, userId);
  },

  updateOrderStatus(orderId: string, status: OrderStatus, userId: string) {
    return ordersService.updateStatus(orderId, status, { userId, role: "CAPTAIN", storeId: null });
  },

  updateLocation(userId: string, latitude: number, longitude: number) {
    return trackingService.updateLocation(userId, latitude, longitude);
  },

  async orderHistory(
    userId: string,
    params: { page: number; pageSize: number; status?: OrderStatus; from?: Date; to?: Date },
  ) {
    const captain = await captainRepository.findByUserId(userId);
    if (!captain) throw new AppError(404, "Captain profile not found", "NOT_FOUND");
    const [total, rows] = await orderRepository.listForCaptain({
      captainId: captain.id,
      status: params.status,
      from: params.from,
      to: params.to,
      page: params.page,
      pageSize: params.pageSize,
    });
    return buildPaginatedDto(
      rows.map((o) => toOrderListItemDto(o)),
      params.page,
      params.pageSize,
      total,
    );
  },

  async earningsSummary(userId: string, range: { from?: Date; to?: Date }) {
    const captain = await captainRepository.findByUserId(userId);
    if (!captain) throw new AppError(404, "Captain profile not found", "NOT_FOUND");

    const where: Prisma.OrderWhereInput = {
      assignedCaptainId: captain.id,
      status: OrderStatus.DELIVERED,
    };
    if (range.from || range.to) {
      where.updatedAt = {};
      if (range.from) where.updatedAt.gte = range.from;
      if (range.to) where.updatedAt.lte = range.to;
    }

    const [agg, count] = await prisma.$transaction([
      prisma.order.aggregate({
        where,
        _sum: { amount: true, cashCollection: true },
      }),
      prisma.order.count({ where }),
    ]);

    const amount = agg._sum.amount?.toString() ?? "0";
    const cashCollection = agg._sum.cashCollection?.toString() ?? "0";

    return {
      deliveredCount: count,
      totalAmount: amount,
      totalCashCollection: cashCollection,
    };
  },
};
