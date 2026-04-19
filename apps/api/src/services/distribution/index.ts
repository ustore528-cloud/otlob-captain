import { $Enums, OrderStatus } from "@prisma/client";
import type { AssignmentType, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { distributionEngine } from "./distribution-engine.js";
import { emitOrderUpdated, emitToCaptain } from "../../realtime/hub.js";
import { CAPTAIN_SOCKET_EVENTS } from "../../realtime/captain-events.js";
import { DISTRIBUTION_TIMEOUT_SECONDS } from "./constants.js";
import { emitCaptainAssignmentEnded } from "../../realtime/order-emits.js";
import { logDistributionTimeout } from "./distribution-timeout-log.js";

type OrderCaptainEmit = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  assignedCaptain: { userId: string } | null;
} | null;

function emitCaptainDistributionSocket(order: OrderCaptainEmit, kind: "OFFER" | "REASSIGNED"): void {
  if (!order?.assignedCaptain?.userId) return;
  emitToCaptain(order.assignedCaptain.userId, CAPTAIN_SOCKET_EVENTS.ASSIGNMENT, {
    kind,
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    timeoutSeconds: DISTRIBUTION_TIMEOUT_SECONDS,
  });
  emitOrderUpdated({ id: order.id, orderNumber: order.orderNumber, status: order.status });
}

/**
 * واجهة موحّدة للمتحكمات والـ worker — تنفّذ عبر DistributionEngine.
 * بعد نجاح المعاملة: إشعار Socket للكابتن المعروض + تحديث للوحة التوزيع.
 */
async function emitAfterTimeoutProcessing(hint: { orderId: string; expiredCaptainId: string }): Promise<void> {
  const expiredCaptain = await prisma.captain.findUnique({
    where: { id: hint.expiredCaptainId },
    select: { userId: true },
  });
  if (expiredCaptain) {
    emitCaptainAssignmentEnded(expiredCaptain.userId, { orderId: hint.orderId, reason: "OFFER_EXPIRED" });
  }

  const order = await prisma.order.findUnique({
    where: { id: hint.orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      assignedCaptain: { select: { userId: true } },
    },
  });
  if (!order) {
    logDistributionTimeout("EMIT_AFTER_TIMEOUT_NO_ORDER", { orderId: hint.orderId });
    return;
  }

  if (order.status === OrderStatus.ASSIGNED && order.assignedCaptain?.userId) {
    emitCaptainDistributionSocket(order, "OFFER");
  } else {
    emitOrderUpdated({ id: order.id, orderNumber: order.orderNumber, status: order.status });
  }
}

export const distributionService = {
  /**
   * يعالج المهلات المستحقة ثم يبث للوحة والكابتن (مثل الرفض اليدوي + إعادة العرض التلقائي).
   */
  tickExpired: async () => {
    logDistributionTimeout("TICK_START", {});
    try {
      const hints = await distributionEngine.processDueTimeouts();
      for (const h of hints) {
        try {
          await emitAfterTimeoutProcessing(h);
          logDistributionTimeout("EMIT_AFTER_TIMEOUT_OK", { orderId: h.orderId });
        } catch (e) {
          logDistributionTimeout("EMIT_AFTER_TIMEOUT_FAIL", {
            orderId: h.orderId,
            error: e instanceof Error ? e.message : String(e),
          });
          console.error("[distributionService.tickExpired] emit", h.orderId, e);
        }
      }
    } catch (e) {
      logDistributionTimeout("TICK_EXPIRED_FAIL", { error: e instanceof Error ? e.message : String(e) });
      console.error("[distributionService.tickExpired]", e);
    }
  },

  startAuto: async (orderId: string, actorUserId: string | null) => {
    const order = await distributionEngine.startAutoDistribution(orderId, actorUserId);
    emitCaptainDistributionSocket(order, "OFFER");
    return order;
  },

  resendToDistribution: async (orderId: string, actorUserId: string | null) => {
    const order = await distributionEngine.resendToDistribution(orderId, actorUserId);
    emitCaptainDistributionSocket(order, "OFFER");
    return order;
  },

  assignManual: async (
    orderId: string,
    captainId: string,
    actorUserId: string | null,
    assignmentType: Extract<AssignmentType, "MANUAL" | "DRAG_DROP"> = $Enums.AssignmentType.MANUAL,
  ) => {
    const order = await distributionEngine.assignManualOverride(orderId, captainId, assignmentType, actorUserId);
    emitCaptainDistributionSocket(order, "OFFER");
    return order;
  },

  reassign: async (orderId: string, captainId: string, actorUserId: string | null) => {
    const order = await distributionEngine.reassign(orderId, captainId, actorUserId);
    emitCaptainDistributionSocket(order, "REASSIGNED");
    return order;
  },

  cancelCaptainAssignment: async (orderId: string, actorUserId: string | null) => {
    const result = await distributionEngine.cancelCaptainAssignment(orderId, actorUserId);
    if (result.cancelledCaptainUserId) {
      emitCaptainAssignmentEnded(result.cancelledCaptainUserId, { orderId, reason: "DISPATCH_CANCELLED" });
    }
    if (result.order) {
      emitOrderUpdated({ id: result.order.id, orderNumber: result.order.orderNumber, status: result.order.status });
    }
    return result.order;
  },

  afterCaptainRejectTx: (tx: Prisma.TransactionClient, orderId: string, actorUserId: string | null) =>
    distributionEngine.afterCaptainRejectTx(tx, orderId, actorUserId),
};

export { distributionEngine } from "./distribution-engine.js";
export { eligibleCaptainsForAutoDistribution, captainEligibleForManualOverride } from "./eligibility.js";
export {
  countCompletedAutoRounds,
  pickCaptainAtRoundIndex,
  pickCaptainForAutoOffer,
  stablePoolIndexFromOrderId,
} from "./round-robin.js";
export { lockOrderDistributionTx } from "./order-lock.js";
export {
  DISTRIBUTION_TIMEOUT_SECONDS,
  OFFER_CONFIRMATION_WINDOW_SECONDS,
  DISTRIBUTION_MAX_AUTO_ATTEMPTS,
  AUTO_CAPTAIN_MAX_ACTIVE_ORDERS,
  ASSIGNMENT_TIMEOUT_NOTE,
} from "./constants.js";
