import { $Enums, OrderStatus, type UserRole } from "@prisma/client";
import type { AssignmentType, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { distributionEngine } from "./distribution-engine.js";
import { AppError } from "../../utils/errors.js";
import { emitOrderUpdated, emitToCaptain } from "../../realtime/hub.js";
import { CAPTAIN_SOCKET_EVENTS } from "../../realtime/captain-events.js";
import { DISTRIBUTION_TIMEOUT_SECONDS } from "./constants.js";
import { emitCaptainAssignmentEnded } from "../../realtime/order-emits.js";
import { logDistributionTimeout } from "./distribution-timeout-log.js";
import { pushNotificationService } from "../push-notification.service.js";
import { assertStaffCanAccessCaptain, assertStaffCanAccessOrder } from "../tenant-scope.service.js";
import type { AppRole } from "../../lib/rbac-roles.js";

type OrderCaptainEmit = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  companyId: string;
  branchId: string;
  assignedCaptain: { userId: string } | null;
} | null;
type DistributionRequestContext = { requestId?: string };
type StaffDistributionScope = {
  userId: string;
  role: AppRole;
  companyId: string | null;
  branchId: string | null;
};

async function assertDispatcherCanAccessDistributionTargets(
  orderId: string,
  actorScope?: StaffDistributionScope,
  captainId?: string,
): Promise<void> {
  if (!actorScope) return;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { companyId: true, branchId: true },
  });
  if (!order) throw new AppError(404, "Order not found", "NOT_FOUND");
  await assertStaffCanAccessOrder(actorScope, order);

  if (!captainId) return;
  const captain = await prisma.captain.findUnique({
    where: { id: captainId },
    select: { companyId: true, branchId: true },
  });
  if (!captain) return;
  await assertStaffCanAccessCaptain(actorScope, captain);
}

function logActionTiming(
  action: "manual_assign" | "resend_distribution" | "reassign",
  phase: string,
  meta: Record<string, unknown>,
): void {
  // eslint-disable-next-line no-console
  console.info("[orders-action-timing]", {
    action,
    phase,
    at: new Date().toISOString(),
    ...meta,
  });
}

function canManualAssignFromStatus(status: OrderStatus): boolean {
  return status === OrderStatus.PENDING || status === OrderStatus.CONFIRMED || status === OrderStatus.ASSIGNED;
}

function canResendFromStatus(_status: OrderStatus): boolean {
  // Keep existing business behavior: resend path currently accepts operational orders regardless of status.
  return true;
}

function canReassignFromStatus(_status: OrderStatus): boolean {
  // Keep existing business behavior: reassignment path currently accepts operational orders regardless of status.
  return true;
}

async function runFastOrderPrecheck(
  action: "manual_assign" | "resend_distribution" | "reassign",
  params: {
    orderId: string;
    t0: number;
    captainId?: string;
    actorUserId?: string | null;
    requestId?: string;
    isStatusAllowed: (status: OrderStatus) => boolean;
    invalidStatusErrorMessage: string;
  },
): Promise<void> {
  const precheckStart = Date.now();
  const pre = await prisma.order.findUnique({
    where: { id: params.orderId },
    select: { id: true, status: true, archivedAt: true },
  });
  logActionTiming(action, "fast_precheck_read_done", {
    requestId: params.requestId,
    orderId: params.orderId,
    actorUserId: params.actorUserId ?? null,
    ...(params.captainId ? { captainId: params.captainId } : {}),
    ms: Date.now() - precheckStart,
    found: Boolean(pre),
    status: pre?.status ?? null,
    archived: Boolean(pre?.archivedAt),
  });
  if (!pre) {
    logActionTiming(action, "fast_precheck_rejected_not_found", {
      requestId: params.requestId,
      orderId: params.orderId,
      actorUserId: params.actorUserId ?? null,
      ...(params.captainId ? { captainId: params.captainId } : {}),
      totalServiceMs: Date.now() - params.t0,
    });
    throw new AppError(404, "Order not found", "NOT_FOUND");
  }
  if (pre.archivedAt) {
    logActionTiming(action, "fast_precheck_rejected_archived", {
      requestId: params.requestId,
      orderId: params.orderId,
      actorUserId: params.actorUserId ?? null,
      ...(params.captainId ? { captainId: params.captainId } : {}),
      status: pre.status,
      totalServiceMs: Date.now() - params.t0,
    });
    throw new AppError(409, "الطلب مؤرشف — لا يمكن تشغيل التوزيع عليه", "ORDER_ARCHIVED");
  }
  if (!params.isStatusAllowed(pre.status)) {
    logActionTiming(action, "fast_precheck_rejected_invalid_status", {
      requestId: params.requestId,
      orderId: params.orderId,
      actorUserId: params.actorUserId ?? null,
      ...(params.captainId ? { captainId: params.captainId } : {}),
      status: pre.status,
      totalServiceMs: Date.now() - params.t0,
    });
    throw new AppError(409, params.invalidStatusErrorMessage, "INVALID_STATE");
  }
}

function emitCaptainDistributionSocket(order: OrderCaptainEmit, kind: "OFFER" | "REASSIGNED"): void {
  if (!order?.assignedCaptain?.userId) return;
  emitToCaptain(order.assignedCaptain.userId, CAPTAIN_SOCKET_EVENTS.ASSIGNMENT, {
    kind,
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    timeoutSeconds: DISTRIBUTION_TIMEOUT_SECONDS,
  });
  emitOrderUpdated(
    { id: order.id, orderNumber: order.orderNumber, status: order.status },
    { companyId: order.companyId, branchId: order.branchId },
  );
  void pushNotificationService.sendCaptainOrderPush({
    userId: order.assignedCaptain.userId,
    title: kind === "REASSIGNED" ? "إعادة تعيين طلب" : "طلب جديد بانتظار قبولك",
    body:
      kind === "REASSIGNED"
        ? `تمت إعادة تعيين الطلب ${order.orderNumber} لك.`
        : `تم عرض الطلب ${order.orderNumber} عليك. اضغط للقبول أو الرفض.`,
    orderId: order.id,
    orderNumber: order.orderNumber,
    kind,
    status: order.status,
  });
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
      companyId: true,
      branchId: true,
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
    emitOrderUpdated(
      { id: order.id, orderNumber: order.orderNumber, status: order.status },
      { companyId: order.companyId, branchId: order.branchId },
    );
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

  startAuto: async (orderId: string, actorUserId: string | null, actorScope?: StaffDistributionScope) => {
    await assertDispatcherCanAccessDistributionTargets(orderId, actorScope);
    const order = await distributionEngine.startAutoDistribution(orderId, actorUserId);
    emitCaptainDistributionSocket(order, "OFFER");
    return order;
  },

  resendToDistribution: async (
    orderId: string,
    actorUserId: string | null,
    ctx: DistributionRequestContext = {},
    actorScope?: StaffDistributionScope,
  ) => {
    const t0 = Date.now();
    logActionTiming("resend_distribution", "service_enter", { requestId: ctx.requestId, orderId, actorUserId });
    await assertDispatcherCanAccessDistributionTargets(orderId, actorScope);
    await runFastOrderPrecheck("resend_distribution", {
      orderId,
      t0,
      actorUserId,
      requestId: ctx.requestId,
      isStatusAllowed: canResendFromStatus,
      invalidStatusErrorMessage: "Order cannot be resent to distribution in current status",
    });
    logActionTiming("resend_distribution", "transaction_enter", {
      requestId: ctx.requestId,
      orderId,
      actorUserId,
      msFromEnter: Date.now() - t0,
    });
    try {
      const order = await distributionEngine.resendToDistribution(orderId, actorUserId, ctx);
      const afterEngine = Date.now();
      logActionTiming("resend_distribution", "engine_done", {
        requestId: ctx.requestId,
        orderId,
        actorUserId,
        orderStatus: order?.status ?? null,
        msFromEnter: afterEngine - t0,
      });
      emitCaptainDistributionSocket(order, "OFFER");
      logActionTiming("resend_distribution", "socket_emit_and_push_enqueue_done", {
        requestId: ctx.requestId,
        orderId,
        actorUserId,
        totalServiceMs: Date.now() - t0,
      });
      return order;
    } catch (error) {
      logActionTiming("resend_distribution", "service_error", {
        requestId: ctx.requestId,
        orderId,
        actorUserId,
        totalServiceMs: Date.now() - t0,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  assignManual: async (
    orderId: string,
    captainId: string,
    actorUserId: string | null,
    assignmentType: Extract<AssignmentType, "MANUAL" | "DRAG_DROP"> = $Enums.AssignmentType.MANUAL,
    ctx: DistributionRequestContext = {},
    actorScope?: StaffDistributionScope,
  ) => {
    const t0 = Date.now();
    logActionTiming("manual_assign", "service_enter", {
      requestId: ctx.requestId,
      orderId,
      captainId,
      actorUserId,
      assignmentType,
    });
    await assertDispatcherCanAccessDistributionTargets(orderId, actorScope, captainId);
    await runFastOrderPrecheck("manual_assign", {
      orderId,
      captainId,
      t0,
      actorUserId,
      requestId: ctx.requestId,
      isStatusAllowed: canManualAssignFromStatus,
      invalidStatusErrorMessage: "Cannot assign order in current status",
    });
    logActionTiming("manual_assign", "transaction_enter", {
      requestId: ctx.requestId,
      orderId,
      captainId,
      actorUserId,
      assignmentType,
      msFromEnter: Date.now() - t0,
    });
    try {
      const order = await distributionEngine.assignManualOverride(orderId, captainId, assignmentType, actorUserId, ctx);
      const afterEngine = Date.now();
      logActionTiming("manual_assign", "engine_done", {
        requestId: ctx.requestId,
        orderId,
        captainId,
        actorUserId,
        orderStatus: order?.status ?? null,
        msFromEnter: afterEngine - t0,
      });
      emitCaptainDistributionSocket(order, "OFFER");
      logActionTiming("manual_assign", "socket_emit_and_push_enqueue_done", {
        requestId: ctx.requestId,
        orderId,
        captainId,
        actorUserId,
        totalServiceMs: Date.now() - t0,
      });
      return order;
    } catch (error) {
      logActionTiming("manual_assign", "service_error", {
        requestId: ctx.requestId,
        orderId,
        captainId,
        actorUserId,
        totalServiceMs: Date.now() - t0,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  reassign: async (
    orderId: string,
    captainId: string,
    actorUserId: string | null,
    ctx: DistributionRequestContext = {},
    actorScope?: StaffDistributionScope,
  ) => {
    const t0 = Date.now();
    logActionTiming("reassign", "service_enter", { requestId: ctx.requestId, orderId, captainId, actorUserId });
    await assertDispatcherCanAccessDistributionTargets(orderId, actorScope, captainId);
    await runFastOrderPrecheck("reassign", {
      orderId,
      captainId,
      t0,
      actorUserId,
      requestId: ctx.requestId,
      isStatusAllowed: canReassignFromStatus,
      invalidStatusErrorMessage: "Cannot reassign order in current status",
    });
    logActionTiming("reassign", "transaction_enter", {
      requestId: ctx.requestId,
      orderId,
      captainId,
      actorUserId,
      msFromEnter: Date.now() - t0,
    });
    try {
      const order = await distributionEngine.reassign(orderId, captainId, actorUserId, ctx);
      logActionTiming("reassign", "engine_done", {
        requestId: ctx.requestId,
        orderId,
        captainId,
        actorUserId,
        orderStatus: order?.status ?? null,
        msFromEnter: Date.now() - t0,
      });
      emitCaptainDistributionSocket(order, "REASSIGNED");
      logActionTiming("reassign", "socket_emit_and_push_enqueue_done", {
        requestId: ctx.requestId,
        orderId,
        captainId,
        actorUserId,
        totalServiceMs: Date.now() - t0,
      });
      return order;
    } catch (error) {
      logActionTiming("reassign", "service_error", {
        requestId: ctx.requestId,
        orderId,
        captainId,
        actorUserId,
        totalServiceMs: Date.now() - t0,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  cancelCaptainAssignment: async (orderId: string, actorUserId: string | null, actorScope?: StaffDistributionScope) => {
    await assertDispatcherCanAccessDistributionTargets(orderId, actorScope);
    const result = await distributionEngine.cancelCaptainAssignment(orderId, actorUserId);
    if (result.cancelledCaptainUserId) {
      emitCaptainAssignmentEnded(result.cancelledCaptainUserId, { orderId, reason: "DISPATCH_CANCELLED" });
    }
    if (result.order) {
      emitOrderUpdated(
        { id: result.order.id, orderNumber: result.order.orderNumber, status: result.order.status },
        { companyId: result.order.companyId, branchId: result.order.branchId },
      );
    }
    return result.order;
  },

  afterCaptainRejectTx: (tx: Prisma.TransactionClient, orderId: string, actorUserId: string | null) =>
    distributionEngine.afterCaptainRejectTx(tx, orderId, actorUserId),
};

export { distributionEngine } from "./distribution-engine.js";
export {
  type AutomaticMultiOrderOverrideGateInput,
  type AutoDistributionPolicy,
  CAPTAIN_ACTIVE_WORKING_ORDER_STATUSES,
  canBypassAutomaticSingleOrderRule,
  captainHasActiveWorkingOrder,
  canCaptainReceiveAutomaticOrder,
  captainEligibleForManualOverride,
  eligibleCaptainsForAutoDistribution,
  isManualMultiOrderOverrideEnabled,
  isCaptainBusyForAutomaticDistribution,
  maxActiveOrdersForAutoDistributionPolicy,
} from "./eligibility.js";
export {
  countCompletedAutoRounds,
  pickCaptainAtRoundIndex,
  pickCaptainForAutoOffer,
  stablePoolIndexFromOrderId,
} from "./round-robin.js";
export { lockCaptainDistributionTx, lockOrderDistributionTx } from "./order-lock.js";
export {
  DISTRIBUTION_TIMEOUT_SECONDS,
  OFFER_CONFIRMATION_WINDOW_SECONDS,
  DISTRIBUTION_MAX_AUTO_ATTEMPTS,
  DEFAULT_AUTO_CAPTAIN_MAX_ACTIVE_ORDERS,
  OVERRIDE_AUTO_CAPTAIN_MAX_ACTIVE_ORDERS,
  ASSIGNMENT_TIMEOUT_NOTE,
} from "./constants.js";
