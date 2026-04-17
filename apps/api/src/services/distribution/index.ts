import { $Enums, type OrderStatus } from "@prisma/client";
import type { AssignmentType, Prisma } from "@prisma/client";
import { distributionEngine } from "./distribution-engine.js";
import { emitOrderUpdated, emitToCaptain } from "../../realtime/hub.js";
import { CAPTAIN_SOCKET_EVENTS } from "../../realtime/captain-events.js";
import { DISTRIBUTION_TIMEOUT_SECONDS } from "./constants.js";
import { emitCaptainAssignmentEnded } from "../../realtime/order-emits.js";

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
export const distributionService = {
  tickExpired: () => distributionEngine.processDueTimeouts(),

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
  DISTRIBUTION_MAX_AUTO_ATTEMPTS,
  AUTO_CAPTAIN_MAX_ACTIVE_ORDERS,
  ASSIGNMENT_TIMEOUT_NOTE,
} from "./constants.js";
