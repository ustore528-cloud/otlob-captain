import { $Enums, AssignmentResponseStatus, OrderStatus, DistributionMode } from "@prisma/client";
import type { Prisma, AssignmentType } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/errors.js";
import { activityService } from "../activity.service.js";
import { notificationService } from "../notifications.service.js";
import { ASSIGNMENT_TIMEOUT_NOTE, DISTRIBUTION_MAX_AUTO_ATTEMPTS, DISTRIBUTION_TIMEOUT_SECONDS } from "./constants.js";
import { eligibleCaptainsForAutoDistribution, captainEligibleForManualOverride } from "./eligibility.js";
import { lockOrderDistributionTx } from "./order-lock.js";
import { countCompletedAutoRounds, pickCaptainAtRoundIndex } from "./round-robin.js";

function expiredAtFromNow(): Date {
  return new Date(Date.now() + DISTRIBUTION_TIMEOUT_SECONDS * 1000);
}

const orderInclude = {
  store: { select: { id: true, name: true } as const },
  assignedCaptain: { include: { user: { select: { id: true, fullName: true, phone: true } as const } } },
  assignmentLogs: { orderBy: { assignedAt: "desc" as const }, take: 15 },
} as const;

async function loadOrder(tx: Prisma.TransactionClient, orderId: string) {
  return tx.order.findUnique({ where: { id: orderId } });
}

/**
 * محرك التوزيع — Round Robin، سجل لكل محاولة، قفل لكل طلب، دعم يدوي / إعادة / سحب-وإفلات.
 */
export class DistributionEngine {
  /**
   * معالجة انتهاء المهلة: تسجيل TIMEOUT ثم الانتقال للكابتن التالي (AUTO فقط).
   * queue-safe: قفل advisory لكل order داخل المعاملة.
   */
  async processDueTimeouts(): Promise<void> {
    const now = new Date();
    const due = await prisma.orderAssignmentLog.findMany({
      where: {
        responseStatus: AssignmentResponseStatus.PENDING,
        expiredAt: { lte: now },
      },
      select: { id: true, orderId: true },
    });

    for (const row of due) {
      try {
        await prisma.$transaction(async (tx) => {
          await lockOrderDistributionTx(tx, row.orderId);

          const log = await tx.orderAssignmentLog.findUnique({ where: { id: row.id } });
          if (!log || log.responseStatus !== AssignmentResponseStatus.PENDING) return;
          if (!log.expiredAt || log.expiredAt > now) return;

          await tx.orderAssignmentLog.update({
            where: { id: log.id },
            data: {
              responseStatus: AssignmentResponseStatus.EXPIRED,
              notes: ASSIGNMENT_TIMEOUT_NOTE(DISTRIBUTION_TIMEOUT_SECONDS),
            },
          });

          const order = await tx.order.findUnique({ where: { id: row.orderId } });
          if (!order) return;

          if (order.distributionMode === DistributionMode.AUTO && order.status === OrderStatus.ASSIGNED) {
            await this.offerNextAutoCaptainTx(tx, order.id, null);
          } else {
            await tx.order.update({
              where: { id: row.orderId },
              data: { status: OrderStatus.PENDING, assignedCaptainId: null },
            });
          }
        });
      } catch (e) {
        console.error("[DistributionEngine] processDueTimeouts", row.id, e);
      }
    }
  }

  /** بعد رفض الكابتن — سلسلة AUTO أو إيقاف يدوي */
  async afterCaptainRejectTx(tx: Prisma.TransactionClient, orderId: string, actorUserId: string | null) {
    await lockOrderDistributionTx(tx, orderId);
    const order = await loadOrder(tx, orderId);
    if (!order) return;
    if (order.distributionMode === DistributionMode.AUTO) {
      await this.offerNextAutoCaptainTx(tx, orderId, actorUserId);
    } else {
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.PENDING, assignedCaptainId: null },
      });
    }
  }

  /**
   * يعرض طلبًا على الكابتن التالي بالدور (AUTO).
   * يُفترض أن المعاملة تحتفظ بقفل order مسبقًا عند الاستدعاء من الداخل بعد timeout.
   */
  async offerNextAutoCaptainTx(
    tx: Prisma.TransactionClient,
    orderId: string,
    actorUserId: string | null,
  ): Promise<{ captainId: string } | null> {
    const order = await loadOrder(tx, orderId);
    if (!order) throw new AppError(404, "Order not found", "NOT_FOUND");

    const pool = await tx.captain.findMany({
      where: eligibleCaptainsForAutoDistribution(),
      orderBy: { id: "asc" },
    });

    if (pool.length === 0) {
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.PENDING, assignedCaptainId: null },
      });
      await activityService.logTx(tx, actorUserId, "DISTRIBUTION_NO_ELIGIBLE_CAPTAINS", "order", orderId, {});
      return null;
    }

    const resetAt = order.lastDistributionResetAt ?? order.createdAt;
    const rounds = await countCompletedAutoRounds(tx, orderId, resetAt);

    if (rounds >= DISTRIBUTION_MAX_AUTO_ATTEMPTS) {
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.PENDING, assignedCaptainId: null },
      });
      await activityService.logTx(tx, actorUserId, "DISTRIBUTION_AUTO_EXHAUSTED", "order", orderId, { rounds });
      return null;
    }

    const captain = pickCaptainAtRoundIndex(pool, rounds);
    if (!captain) return null;

    await tx.orderAssignmentLog.create({
      data: {
        orderId,
        captainId: captain.id,
        assignmentType: $Enums.AssignmentType.AUTO,
        responseStatus: AssignmentResponseStatus.PENDING,
        expiredAt: expiredAtFromNow(),
      },
    });

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.ASSIGNED,
        assignedCaptainId: captain.id,
      },
    });

    await notificationService.notifyCaptainTx(
      tx,
      captain.userId,
      "ORDER_ASSIGNMENT_OFFER",
      "طلب — بانتظار قبولك",
      `طلب ${order.orderNumber}: لديك ${DISTRIBUTION_TIMEOUT_SECONDS} ثانية للقبول أو الانتقال للكابتن التالي.`,
    );

    await activityService.logTx(tx, actorUserId, "DISTRIBUTION_AUTO_OFFER", "order", orderId, {
      captainId: captain.id,
      roundIndex: rounds,
      poolSize: pool.length,
    });

    return { captainId: captain.id };
  }

  async startAutoDistribution(orderId: string, actorUserId: string | null) {
    return prisma.$transaction(async (tx) => {
      await lockOrderDistributionTx(tx, orderId);

      const order = await loadOrder(tx, orderId);
      if (!order) throw new AppError(404, "Order not found", "NOT_FOUND");
      if (order.distributionMode !== DistributionMode.AUTO) {
        throw new AppError(400, "Order distribution mode is not AUTO", "INVALID_STATE");
      }
      if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.CONFIRMED) {
        throw new AppError(409, "Order is not awaiting distribution", "INVALID_STATE");
      }

      await tx.orderAssignmentLog.updateMany({
        where: { orderId, responseStatus: AssignmentResponseStatus.PENDING },
        data: {
          responseStatus: AssignmentResponseStatus.CANCELLED,
          notes: "Cancelled: restart auto distribution",
        },
      });

      await tx.order.update({
        where: { id: orderId },
        data: { lastDistributionResetAt: new Date() },
      });

      await this.offerNextAutoCaptainTx(tx, orderId, actorUserId);

      return tx.order.findUnique({ where: { id: orderId }, include: orderInclude });
    });
  }

  async resendToDistribution(orderId: string, actorUserId: string | null) {
    return prisma.$transaction(async (tx) => {
      await lockOrderDistributionTx(tx, orderId);

      const order = await loadOrder(tx, orderId);
      if (!order) throw new AppError(404, "Order not found", "NOT_FOUND");

      await tx.orderAssignmentLog.updateMany({
        where: { orderId, responseStatus: AssignmentResponseStatus.PENDING },
        data: {
          responseStatus: AssignmentResponseStatus.CANCELLED,
          notes: "Cancelled: resend to distribution",
        },
      });

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.PENDING,
          assignedCaptainId: null,
          distributionMode: DistributionMode.AUTO,
          lastDistributionResetAt: new Date(),
        },
      });

      await activityService.logTx(tx, actorUserId, "ORDER_RESEND_DISTRIBUTION", "order", orderId, {});

      await this.offerNextAutoCaptainTx(tx, orderId, actorUserId);

      return tx.order.findUnique({ where: { id: orderId }, include: orderInclude });
    });
  }

  /**
   * تعيين يدوي من لوحة التحكم — MANUAL أو DRAG_DROP (نفس آلية المهلة 30ث).
   * يتجاوز أولوية التوزيع التلقائي (distributionMode → MANUAL).
   */
  async assignManualOverride(
    orderId: string,
    captainId: string,
    assignmentType: Extract<AssignmentType, "MANUAL" | "DRAG_DROP">,
    actorUserId: string | null,
  ) {
    return prisma.$transaction(async (tx) => {
      await lockOrderDistributionTx(tx, orderId);

      const order = await loadOrder(tx, orderId);
      if (!order) throw new AppError(404, "Order not found", "NOT_FOUND");
      if (
        order.status !== OrderStatus.PENDING &&
        order.status !== OrderStatus.CONFIRMED &&
        order.status !== OrderStatus.ASSIGNED
      ) {
        throw new AppError(409, "Cannot assign order in current status", "INVALID_STATE");
      }

      const captain = await tx.captain.findUnique({
        where: { id: captainId },
        include: { user: true },
      });
      if (!captain || !captainEligibleForManualOverride(captain)) {
        throw new AppError(400, "Captain not eligible for manual assignment", "CAPTAIN_UNAVAILABLE");
      }

      await tx.orderAssignmentLog.updateMany({
        where: { orderId, responseStatus: AssignmentResponseStatus.PENDING },
        data: {
          responseStatus: AssignmentResponseStatus.CANCELLED,
          notes: `Cancelled: ${String(assignmentType).toLowerCase()} override`,
        },
      });

      await tx.orderAssignmentLog.create({
        data: {
          orderId,
          captainId: captain.id,
          assignmentType,
          responseStatus: AssignmentResponseStatus.PENDING,
          expiredAt: expiredAtFromNow(),
        },
      });

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.ASSIGNED,
          assignedCaptainId: captain.id,
          distributionMode: DistributionMode.MANUAL,
        },
      });

      await notificationService.notifyCaptainTx(
        tx,
        captain.userId,
        "ORDER_ASSIGNMENT_OFFER",
        assignmentType === $Enums.AssignmentType.DRAG_DROP ? "تعيين (سحب وإفلات)" : "تعيين يدوي",
        `تم تعيينك للطلب ${order.orderNumber}. يرجى الرد خلال ${DISTRIBUTION_TIMEOUT_SECONDS} ثانية.`,
      );

      await activityService.logTx(tx, actorUserId, "ORDER_MANUAL_ASSIGN", "order", orderId, {
        captainId,
        assignmentType,
      });

      return tx.order.findUnique({ where: { id: orderId }, include: orderInclude });
    });
  }

  async reassign(orderId: string, captainId: string, actorUserId: string | null) {
    return prisma.$transaction(async (tx) => {
      await lockOrderDistributionTx(tx, orderId);

      const order = await loadOrder(tx, orderId);
      if (!order) throw new AppError(404, "Order not found", "NOT_FOUND");

      const captain = await tx.captain.findUnique({
        where: { id: captainId },
        include: { user: true },
      });
      if (!captain || !captainEligibleForManualOverride(captain)) {
        throw new AppError(400, "Captain not eligible for reassignment", "CAPTAIN_UNAVAILABLE");
      }

      await tx.orderAssignmentLog.updateMany({
        where: { orderId, responseStatus: AssignmentResponseStatus.PENDING },
        data: {
          responseStatus: AssignmentResponseStatus.CANCELLED,
          notes: "Cancelled: reassign",
        },
      });

      await tx.orderAssignmentLog.create({
        data: {
          orderId,
          captainId: captain.id,
          assignmentType: $Enums.AssignmentType.REASSIGN,
          responseStatus: AssignmentResponseStatus.PENDING,
          expiredAt: expiredAtFromNow(),
        },
      });

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.ASSIGNED,
          assignedCaptainId: captain.id,
        },
      });

      await notificationService.notifyCaptainTx(
        tx,
        captain.userId,
        "ORDER_REASSIGNED",
        "إعادة تعيين",
        `تم إعادة تعيينك للطلب ${order.orderNumber}.`,
      );

      await activityService.logTx(tx, actorUserId, "ORDER_REASSIGNED", "order", orderId, { captainId });

      return tx.order.findUnique({ where: { id: orderId }, include: orderInclude });
    });
  }
}

export const distributionEngine = new DistributionEngine();
