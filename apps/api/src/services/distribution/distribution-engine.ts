import { $Enums, AssignmentResponseStatus, OrderStatus, DistributionMode } from "@prisma/client";
import type { Prisma, AssignmentType } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/errors.js";
import { activityService } from "../activity.service.js";
import { notificationService } from "../notifications.service.js";
import {
  ASSIGNMENT_TIMEOUT_NOTE,
  AUTO_CAPTAIN_MAX_ACTIVE_ORDERS,
  DISTRIBUTION_MAX_AUTO_ATTEMPTS,
  DISTRIBUTION_TIMEOUT_SECONDS,
  OFFER_CONFIRMATION_WINDOW_SECONDS,
} from "./constants.js";
import { logOfferCreationDiagnostics } from "./offer-diagnostics.js";
import { logDistributionTimeout } from "./distribution-timeout-log.js";
import { eligibleCaptainsForAutoDistribution, captainEligibleForManualOverride } from "./eligibility.js";
import { lockOrderDistributionTx } from "./order-lock.js";
import { countCompletedAutoRounds, pickCaptainForAutoOffer } from "./round-robin.js";

function expiredAtFromNow(): Date {
  return new Date(Date.now() + OFFER_CONFIRMATION_WINDOW_SECONDS * 1000);
}

async function logOfferRowInsertedDiagnostics(
  tx: Prisma.TransactionClient,
  phase: string,
  orderId: string,
  captainId: string,
): Promise<void> {
  const row = await tx.orderAssignmentLog.findFirst({
    where: { orderId, captainId, responseStatus: AssignmentResponseStatus.PENDING },
    orderBy: { assignedAt: "desc" },
  });
  if (row?.expiredAt) {
    logOfferCreationDiagnostics({
      phase,
      orderId,
      captainId,
      assignedAt: row.assignedAt,
      expiredAt: row.expiredAt,
    });
  }
}

function logAssignmentCreated(
  kind: string,
  ctx: { orderId: string; captainId: string; expiredAt: Date; assignmentType: string },
): void {
  logDistributionTimeout("ASSIGNMENT_CREATED", {
    kind,
    orderId: ctx.orderId,
    captainId: ctx.captainId,
    assignmentType: ctx.assignmentType,
    expiredAtIso: ctx.expiredAt.toISOString(),
    timeoutSeconds: DISTRIBUTION_TIMEOUT_SECONDS,
  });
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
  /**
   * يعالج سجلات التعيين التي تجاوزت `expiredAt`.
   * يُستدعى من `setInterval` في `server.ts` كل `DISTRIBUTION_POLL_MS`.
   *
   * **تعدد النسخ:** كل نسخة Node تشغّل حلقة خاصة؛ لا يوجد قفل عالمي هنا.
   * تضارب على نفس الطلب يُخفّفه `lockOrderDistributionTx` داخل المعاملة (ليس إزالة كاملة لازدواجية العمل).
   *
   * @returns طلبات يجب بث تحديثها للواجهات بعد نجاح المعاملة
   */
  async processDueTimeouts(): Promise<{ orderId: string; expiredCaptainId: string }[]> {
    const now = new Date();
    /** Also due when wall-clock has passed `assignedAt + window` (recovers bad `expiredAt` in DB). */
    const assignedNotAfter = new Date(now.getTime() - DISTRIBUTION_TIMEOUT_SECONDS * 1000);
    const due = await prisma.orderAssignmentLog.findMany({
      where: {
        responseStatus: AssignmentResponseStatus.PENDING,
        OR: [{ expiredAt: { lte: now } }, { assignedAt: { lte: assignedNotAfter } }],
      },
      select: { id: true, orderId: true, captainId: true, expiredAt: true },
    });

    logDistributionTimeout("SCAN", {
      dueCount: due.length,
      nowIso: now.toISOString(),
      timeoutSeconds: DISTRIBUTION_TIMEOUT_SECONDS,
      assignedNotAfterIso: assignedNotAfter.toISOString(),
    });

    const emitHints: { orderId: string; expiredCaptainId: string }[] = [];

    for (const row of due) {
      try {
        logDistributionTimeout("PROCESS_START", {
          logId: row.id,
          orderId: row.orderId,
          captainId: row.captainId,
          expiredAtIso: row.expiredAt?.toISOString() ?? null,
        });

        const processed = await prisma.$transaction(async (tx) => {
          await lockOrderDistributionTx(tx, row.orderId);

          const log = await tx.orderAssignmentLog.findUnique({ where: { id: row.id } });
          if (!log || log.responseStatus !== AssignmentResponseStatus.PENDING) {
            logDistributionTimeout("SKIP_NOT_PENDING", { logId: row.id });
            return false;
          }
          /** وقت داخل المعاملة — يقلل تعارض مقارنة `now` الخارجي إذا تأخرت المعاملة */
          const nowInTx = new Date();
          const windowEnd = new Date(log.assignedAt.getTime() + DISTRIBUTION_TIMEOUT_SECONDS * 1000);
          const dueByExpiryField = log.expiredAt != null && log.expiredAt.getTime() <= nowInTx.getTime();
          const dueByWallClock = nowInTx.getTime() >= windowEnd.getTime();
          if (!dueByExpiryField && !dueByWallClock) {
            logDistributionTimeout("SKIP_NOT_YET_DUE", {
              logId: row.id,
              expiredAtIso: log.expiredAt?.toISOString() ?? null,
              nowInTxIso: nowInTx.toISOString(),
              windowEndIso: windowEnd.toISOString(),
            });
            return false;
          }

          await tx.orderAssignmentLog.update({
            where: { id: log.id },
            data: {
              responseStatus: AssignmentResponseStatus.EXPIRED,
              notes: ASSIGNMENT_TIMEOUT_NOTE(DISTRIBUTION_TIMEOUT_SECONDS),
            },
          });

          logDistributionTimeout("LOG_MARKED_EXPIRED", { logId: log.id, orderId: row.orderId });

          const order = await tx.order.findUnique({ where: { id: row.orderId } });
          if (!order) return true;

          if (order.distributionMode === DistributionMode.AUTO && order.status === OrderStatus.ASSIGNED) {
            const next = await this.offerNextAutoCaptainTx(tx, order.id, null);
            logDistributionTimeout(next ? "AUTO_REOFFER_OK" : "AUTO_REOFFER_STOPPED", {
              orderId: order.id,
              nextCaptainId: next?.captainId,
            });
          } else {
            await tx.order.update({
              where: { id: row.orderId },
              data: { status: OrderStatus.PENDING, assignedCaptainId: null },
            });
            logDistributionTimeout("MANUAL_OR_NON_AUTO_RELEASE", {
              orderId: row.orderId,
              distributionMode: order.distributionMode,
              previousStatus: order.status,
            });
          }
          return true;
        });

        if (processed) {
          emitHints.push({ orderId: row.orderId, expiredCaptainId: row.captainId });
          logDistributionTimeout("PROCESS_OK", { orderId: row.orderId, logId: row.id });
        }
      } catch (e) {
        logDistributionTimeout("PROCESS_FAIL", {
          logId: row.id,
          orderId: row.orderId,
          error: e instanceof Error ? e.message : String(e),
        });
        console.error("[DistributionEngine] processDueTimeouts", row.id, e);
      }
    }

    return emitHints;
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

    const capacityRows = await tx.order.groupBy({
      by: ["assignedCaptainId"],
      where: {
        assignedCaptainId: { not: null },
        distributionMode: DistributionMode.AUTO,
        status: { in: [OrderStatus.ASSIGNED, OrderStatus.ACCEPTED, OrderStatus.PICKED_UP, OrderStatus.IN_TRANSIT] },
      },
      _count: { _all: true },
    });
    const loadByCaptain = new Map(
      capacityRows
        .filter((r) => r.assignedCaptainId)
        .map((r) => [r.assignedCaptainId as string, r._count._all]),
    );
    const availablePool = pool.filter((c) => (loadByCaptain.get(c.id) ?? 0) < AUTO_CAPTAIN_MAX_ACTIVE_ORDERS);

    if (availablePool.length === 0) {
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.PENDING, assignedCaptainId: null },
      });
      await activityService.logTx(tx, actorUserId, "DISTRIBUTION_NO_ELIGIBLE_CAPTAINS", "order", orderId, {
        reason: "AUTO_CAPACITY_REACHED_OR_NO_AVAILABLE",
      });
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

    const captain = pickCaptainForAutoOffer(availablePool, orderId, rounds);
    if (!captain) return null;

    const offerExpiresAt = expiredAtFromNow();
    await tx.orderAssignmentLog.create({
      data: {
        orderId,
        captainId: captain.id,
        assignmentType: $Enums.AssignmentType.AUTO,
        responseStatus: AssignmentResponseStatus.PENDING,
        expiredAt: offerExpiresAt,
      },
    });
    await logOfferRowInsertedDiagnostics(tx, "AUTO_OFFER", orderId, captain.id);
    logAssignmentCreated("AUTO_OFFER", {
      orderId,
      captainId: captain.id,
      expiredAt: offerExpiresAt,
      assignmentType: "AUTO",
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
      poolSize: availablePool.length,
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

  async cancelCaptainAssignment(orderId: string, actorUserId: string | null) {
    return prisma.$transaction(async (tx) => {
      await lockOrderDistributionTx(tx, orderId);
      const order = await loadOrder(tx, orderId);
      if (!order) throw new AppError(404, "Order not found", "NOT_FOUND");

      if (!order.assignedCaptainId) {
        throw new AppError(409, "Order has no assigned captain", "INVALID_STATE");
      }

      if (order.status === OrderStatus.DELIVERED || order.status === OrderStatus.CANCELLED) {
        throw new AppError(409, "Cannot cancel captain on closed order", "INVALID_STATE");
      }

      const previousCaptainId = order.assignedCaptainId;
      const previousCaptain = await tx.captain.findUnique({
        where: { id: previousCaptainId },
        include: { user: { select: { id: true } } },
      });

      await tx.orderAssignmentLog.updateMany({
        where: { orderId, responseStatus: AssignmentResponseStatus.PENDING },
        data: {
          responseStatus: AssignmentResponseStatus.CANCELLED,
          notes: "Cancelled: dispatcher removed captain assignment",
        },
      });

      await tx.order.update({
        where: { id: orderId },
        data: {
          assignedCaptainId: null,
          status: OrderStatus.CONFIRMED,
        },
      });

      await activityService.logTx(tx, actorUserId, "ORDER_CAPTAIN_ASSIGNMENT_CANCELLED", "order", orderId, {
        captainId: previousCaptainId,
      });

      const cancelledCaptainUserId = previousCaptain?.user.id ?? null;
      if (cancelledCaptainUserId) {
        await notificationService.notifyCaptainTx(
          tx,
          cancelledCaptainUserId,
          "ORDER_ASSIGNMENT_CANCELLED",
          "تم إلغاء التعيين",
          `تم إلغاء تعيينك من الطلب ${order.orderNumber}.`,
        );
      }

      const nextOrder = await tx.order.findUnique({ where: { id: orderId }, include: orderInclude });
      return { order: nextOrder, cancelledCaptainUserId };
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

      const manualExpiresAt = expiredAtFromNow();
      await tx.orderAssignmentLog.create({
        data: {
          orderId,
          captainId: captain.id,
          assignmentType,
          responseStatus: AssignmentResponseStatus.PENDING,
          expiredAt: manualExpiresAt,
        },
      });
      await logOfferRowInsertedDiagnostics(
        tx,
        assignmentType === $Enums.AssignmentType.DRAG_DROP ? "DRAG_DROP" : "MANUAL",
        orderId,
        captain.id,
      );
      logAssignmentCreated(assignmentType === $Enums.AssignmentType.DRAG_DROP ? "DRAG_DROP" : "MANUAL", {
        orderId,
        captainId: captain.id,
        expiredAt: manualExpiresAt,
        assignmentType: String(assignmentType),
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

      const reassignExpiresAt = expiredAtFromNow();
      await tx.orderAssignmentLog.create({
        data: {
          orderId,
          captainId: captain.id,
          assignmentType: $Enums.AssignmentType.REASSIGN,
          responseStatus: AssignmentResponseStatus.PENDING,
          expiredAt: reassignExpiresAt,
        },
      });
      await logOfferRowInsertedDiagnostics(tx, "REASSIGN", orderId, captain.id);
      logAssignmentCreated("REASSIGN", {
        orderId,
        captainId: captain.id,
        expiredAt: reassignExpiresAt,
        assignmentType: "REASSIGN",
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
