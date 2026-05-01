import { $Enums, AssignmentResponseStatus, OrderStatus, DistributionMode, UserRole } from "@prisma/client";
import type { Prisma, AssignmentType } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/errors.js";
import { activityService } from "../activity.service.js";
import { notificationService } from "../notifications.service.js";
import {
  ASSIGNMENT_TIMEOUT_NOTE,
  DISTRIBUTION_MAX_AUTO_ATTEMPTS,
  DISTRIBUTION_TIMEOUT_SECONDS,
  OFFER_CONFIRMATION_WINDOW_SECONDS,
} from "./constants.js";
import { logOfferCreationDiagnostics } from "./offer-diagnostics.js";
import { logDistributionTimeout } from "./distribution-timeout-log.js";
import {
  type AutomaticMultiOrderOverrideGateInput,
  type AutoDistributionPolicy,
  CAPTAIN_ACTIVE_WORKING_ORDER_STATUSES,
  canBypassAutomaticSingleOrderRule,
  captainPoolWhereAutoDistribution,
} from "./eligibility.js";
import { lockCaptainDistributionTx, lockOrderDistributionTx } from "./order-lock.js";
import { countCompletedAutoRounds, pickCaptainForAutoOffer } from "./round-robin.js";
import { captainPrepaidBalanceService } from "../captain-prepaid-balance.service.js";
import type { AppRole } from "../../lib/rbac-roles.js";
import {
  assertAssignmentEligibilityOrThrow,
  canAssignCaptainToOrder,
  isSuperAdminPlatformOrder,
  loadLatestCaptainLocationsTx,
  logAssignmentEligibilityAudit,
} from "./assignment-eligibility.js";
import { orderStoreListSelect } from "../../repositories/order-store-enrichment.js";
import { assertCaptainSupervisorScopeForOrderTx } from "./supervisor-order-scope.js";

/**
 * Default Prisma interactive transaction timeout is 5s. Distribution txs run several writes + notifications
 * against a remote DB — latency can exceed 5s → P2028 "Transaction already closed" and HTTP 500.
 */
export const DISTRIBUTION_TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 } as const;
export type DistributionRequestContext = {
  requestId?: string;
  /** لتدقيق الشروط وسجلات eligibility */
  actorRole?: AppRole | null;
  /**
   * When true (e.g. SUPER_ADMIN / COMPANY_ADMIN / legacy ADMIN), skip store–captain
   * supervisor link match for SUPERVISOR_LINKED — same idea as read-path bypass in `supervisor-order-read-scope`.
   */
  bypassSupervisorLinkScope?: boolean;
  /**
   * COMPANY_ADMIN only (set in `mergeEngineCtx`): same-company/branch is enough; do not require
   * `captain.createdByUserId === order.ownerUserId` and broaden AUTO pool to all branch captains.
   */
  bypassOrderOwnerCaptainFleetForCompanyAdmin?: boolean;
};
type AssignmentPath = "automatic" | "manual";

function logEngineTiming(
  action: "manual_assign" | "resend_distribution" | "reassign",
  phase: string,
  meta: Record<string, unknown>,
): void {
  // eslint-disable-next-line no-console
  console.info("[orders-action-timing]", {
    layer: "distribution_engine",
    action,
    phase,
    at: new Date().toISOString(),
    ...meta,
  });
}

function logAssignmentDecision(
  phase: string,
  meta: {
    requestId?: string;
    orderId: string;
    captainId: string | null;
    assignmentPath: AssignmentPath;
    activeBlockingOrderCount: number | null;
    eligibilityResult: boolean;
    exclusionReason: string | null;
    overrideEnabled: boolean;
  },
): void {
  // eslint-disable-next-line no-console
  console.info("[distribution-decision]", {
    phase,
    at: new Date().toISOString(),
    requestId: meta.requestId ?? null,
    orderId: meta.orderId,
    captainId: meta.captainId,
    assignmentPath: meta.assignmentPath,
    activeBlockingOrderCount: meta.activeBlockingOrderCount,
    eligibilityResult: meta.eligibilityResult,
    exclusionReason: meta.exclusionReason,
    overrideEnabled: meta.overrideEnabled,
  });
}

function expiredAtFromNow(): Date {
  return new Date(Date.now() + OFFER_CONFIRMATION_WINDOW_SECONDS * 1000);
}

/** Uses the row returned from `orderAssignmentLog.create` — avoids an extra `findFirst` round-trip per offer. */
function logOfferRowInsertedDiagnostics(
  phase: string,
  orderId: string,
  captainId: string,
  created: { assignedAt: Date; expiredAt: Date | null },
): void {
  if (!created.expiredAt) return;
  logOfferCreationDiagnostics({
    phase,
    orderId,
    captainId,
    assignedAt: created.assignedAt,
    expiredAt: created.expiredAt,
  });
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
  store: { select: orderStoreListSelect },
  assignedCaptain: { include: { user: { select: { id: true, fullName: true, phone: true } as const } } },
  assignmentLogs: { orderBy: { assignedAt: "desc" as const }, take: 15 },
} as const;

async function loadOrder(tx: Prisma.TransactionClient, orderId: string) {
  return tx.order.findUnique({
    where: { id: orderId },
    include: { createdBy: { select: { id: true, role: true } } },
  });
}

function assertOrderOperationalForDistribution<T extends { archivedAt?: Date | null }>(
  order: T | null,
): asserts order is T {
  if (!order) throw new AppError(404, "Order not found", "NOT_FOUND");
  if (order.archivedAt) {
    throw new AppError(409, "الطلب مؤرشف — لا يمكن تشغيل التوزيع عليه", "ORDER_ARCHIVED");
  }
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

          const orderRow = await loadOrder(tx, row.orderId);
          if (!orderRow) return true;

          if (orderRow.distributionMode === DistributionMode.AUTO && orderRow.status === OrderStatus.ASSIGNED) {
            /** No engineCtx: owner-fleet pool only (see Phase 3.2.4 note on `offerNextAutoCaptainTx`). */
            const next = await this.offerNextAutoCaptainTx(tx, orderRow.id, null);
            logDistributionTimeout(next ? "AUTO_REOFFER_OK" : "AUTO_REOFFER_STOPPED", {
              orderId: orderRow.id,
              nextCaptainId: next?.captainId,
            });
          } else {
            await tx.order.update({
              where: { id: row.orderId },
              data: { status: OrderStatus.PENDING, assignedCaptainId: null },
            });
            logDistributionTimeout("MANUAL_OR_NON_AUTO_RELEASE", {
              orderId: row.orderId,
              distributionMode: orderRow.distributionMode,
              previousStatus: orderRow.status,
            });
          }
          return true;
        }, DISTRIBUTION_TRANSACTION_OPTIONS);

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
    if (order.archivedAt) return;
    if (order.distributionMode === DistributionMode.AUTO) {
      /** No engineCtx: owner-fleet pool only (see Phase 3.2.4 note on `offerNextAutoCaptainTx`). */
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
   * الاستثناء multi-order في AUTO لا يعمل إلا عبر overrideGate صريح وصالح.
   * يُفترض أن المعاملة تحتفظ بقفل order مسبقًا عند الاستدعاء من الداخل بعد timeout.
   */
  async offerNextAutoCaptainTx(
    tx: Prisma.TransactionClient,
    orderId: string,
    actorUserId: string | null,
    overrideGate?: AutomaticMultiOrderOverrideGateInput,
    requestId?: string,
    engineCtx?: DistributionRequestContext,
  ): Promise<{ captainId: string } | null> {
    const policy: AutoDistributionPolicy = overrideGate
      ? "OVERRIDE_MULTI_ORDER"
      : "DEFAULT_SINGLE_ORDER";
    if (overrideGate && !canBypassAutomaticSingleOrderRule(overrideGate)) {
      logAssignmentDecision("AUTO_OVERRIDE_GATE_REJECTED", {
        requestId,
        orderId,
        captainId: null,
        assignmentPath: "automatic",
        activeBlockingOrderCount: null,
        eligibilityResult: false,
        exclusionReason: "INVALID_OVERRIDE_GATE",
        overrideEnabled: true,
      });
      throw new AppError(
        400,
        "Invalid automatic multi-order override gate; explicit enablement and overrideSource are required",
        "INVALID_OVERRIDE_GATE",
      );
    }
    const order = await loadOrder(tx, orderId);
    assertOrderOperationalForDistribution(order);
    const prepaidGatingSettings = await captainPrepaidBalanceService.ensurePrepaidDashboardSettingsTx(tx);
    if (policy === "OVERRIDE_MULTI_ORDER") {
      await activityService.logTx(tx, actorUserId, "DISTRIBUTION_AUTO_OVERRIDE_GATE_USED", "order", orderId, {
        overrideSource: overrideGate?.overrideSource ?? null,
      });
    }

    /**
     * Pool selection:
     * - طلب أنشأه SUPER_ADMIN: شركة الطلب كاملة (بدون قيد الفرع) + بوابة مسافة عند وجود coords التقاط.
     * - طلب شركة عادي: شرط فرع الطلب كما كان.
     */
    const platformSaOrder = isSuperAdminPlatformOrder(order.createdBy?.role ?? null);
    const fleetCreatedByMustMatchOwner =
      engineCtx?.bypassOrderOwnerCaptainFleetForCompanyAdmin === true ? undefined : (order.ownerUserId ?? undefined);

    const poolWhere = captainPoolWhereAutoDistribution({
      orderCompanyId: order.companyId,
      orderBranchId: order.branchId,
      restrictToOrderBranch: !platformSaOrder,
      ...(fleetCreatedByMustMatchOwner ? { captainCreatedByUserIdMustMatch: fleetCreatedByMustMatchOwner } : {}),
    });

    const pool = await tx.captain.findMany({
      where: poolWhere,
      orderBy: { id: "asc" },
      include: { user: { select: { isActive: true, role: true, fullName: true, phone: true } } },
    });

    const locMap = await loadLatestCaptainLocationsTx(
      tx,
      pool.map((c) => c.id),
    );
    const applyProxGate =
      platformSaOrder && order.pickupLat != null && order.pickupLng != null;
    const actorForEligibility: AppRole = engineCtx?.actorRole ?? UserRole.DISPATCHER;
    const assignAudit = process.env.ASSIGN_ELIGIBILITY_AUDIT === "1";

    const capacityRows = await tx.order.groupBy({
      by: ["assignedCaptainId"],
      where: {
        assignedCaptainId: { not: null },
        /** Auto-offer capacity guard counts all active captain orders, regardless of how they were assigned. */
        status: { in: CAPTAIN_ACTIVE_WORKING_ORDER_STATUSES },
      },
      _count: { _all: true },
    });
    const loadByCaptain = new Map(
      capacityRows
        .filter((r) => r.assignedCaptainId)
        .map((r) => {
          const count =
            typeof r._count === "number"
              ? r._count
              : typeof r._count === "object" && r._count
                ? (r._count._all ?? 0)
                : 0;
          return [r.assignedCaptainId as string, count] as const;
        }),
    );
    type PoolCap = (typeof pool)[number];
    const availablePool: PoolCap[] = [];
    for (const captain of pool) {
      const activeBlockingOrderCount = loadByCaptain.get(captain.id) ?? 0;
      const prepaidBlockReason = await captainPrepaidBalanceService.getReceivingBlockReasonTx(
        tx,
        captain.id,
        prepaidGatingSettings,
      );
      const eligibilityCore = canAssignCaptainToOrder({
        actor: { role: actorForEligibility },
        order: {
          companyId: order.companyId,
          branchId: order.branchId,
          zoneId: order.zoneId ?? null,
          pickupLat: order.pickupLat ?? null,
          pickupLng: order.pickupLng ?? null,
          createdByRole: order.createdBy?.role ?? null,
        },
        captain: {
          id: captain.id,
          companyId: captain.companyId,
          branchId: captain.branchId,
          zoneId: captain.zoneId,
          isActive: captain.isActive,
          availabilityStatus: captain.availabilityStatus,
          user: captain.user,
        },
        mode: "AUTO_DISTRIBUTION",
        captainLatestLocation: locMap.get(captain.id) ?? null,
        activeBlockingOrderCount,
        autoDistributionPolicy: policy,
        applySuperAdminProximityGate: applyProxGate,
      });
      const eligibilityResult = eligibilityCore.allowed && !prepaidBlockReason;
      if (eligibilityResult) availablePool.push(captain);

      const exclusionParts = [
        !eligibilityCore.allowed ? eligibilityCore.reasonCode : null,
        prepaidBlockReason,
      ].filter(Boolean);
      logAssignmentDecision("AUTO_POOL_EVALUATED", {
        requestId,
        orderId,
        captainId: captain.id,
        assignmentPath: "automatic",
        activeBlockingOrderCount,
        eligibilityResult,
        exclusionReason:
          exclusionParts.length > 0
            ? exclusionParts.join(";")
            : null,
        overrideEnabled: policy === "OVERRIDE_MULTI_ORDER",
      });

      if (assignAudit) {
        logAssignmentEligibilityAudit("AUTO_POOL", {
          orderNumber: order.orderNumber,
          orderCompanyId: order.companyId,
          orderBranchId: order.branchId,
          actorRole: actorForEligibility,
          pickupLat: order.pickupLat ?? null,
          pickupLng: order.pickupLng ?? null,
          captainName: "",
          captainPhone: "",
          captainCompanyId: captain.companyId,
          captainBranchId: captain.branchId,
          distanceMeters: eligibilityCore.distanceMeters,
          allowed: eligibilityResult,
          reasonCode: eligibilityCore.allowed ? "OK" : eligibilityCore.reasonCode,
        });
      }
    }

    if (availablePool.length === 0) {
      logAssignmentDecision("AUTO_NO_ELIGIBLE_POOL", {
        requestId,
        orderId,
        captainId: null,
        assignmentPath: "automatic",
        activeBlockingOrderCount: null,
        eligibilityResult: false,
        exclusionReason: "AUTO_CAPACITY_REACHED_OR_NO_AVAILABLE",
        overrideEnabled: policy === "OVERRIDE_MULTI_ORDER",
      });
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.PENDING, assignedCaptainId: null },
      });
      await activityService.logTx(tx, actorUserId, "DISTRIBUTION_NO_ELIGIBLE_CAPTAINS", "order", orderId, {
        reason: "AUTO_CAPACITY_REACHED_OR_NO_AVAILABLE",
        policy,
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

    const candidatePool = [...availablePool];
    let selectedCaptain: (typeof candidatePool)[number] | null = null;
    while (candidatePool.length > 0) {
      const captain = pickCaptainForAutoOffer(candidatePool, orderId, rounds);
      if (!captain) break;

      // Hard gate before offer creation/assignment: serialize + recheck captain load in this transaction.
      await lockCaptainDistributionTx(tx, captain.id);
      const activeWorkingOrdersCount = await tx.order.count({
        where: {
          assignedCaptainId: captain.id,
          status: { in: CAPTAIN_ACTIVE_WORKING_ORDER_STATUSES },
        },
      });
      const prepaidBlockReason = await captainPrepaidBalanceService.getReceivingBlockReasonTx(
        tx,
        captain.id,
        prepaidGatingSettings,
      );
      const eligibilityCore = canAssignCaptainToOrder({
        actor: { role: actorForEligibility },
        order: {
          companyId: order.companyId,
          branchId: order.branchId,
          zoneId: order.zoneId ?? null,
          pickupLat: order.pickupLat ?? null,
          pickupLng: order.pickupLng ?? null,
          createdByRole: order.createdBy?.role ?? null,
        },
        captain: {
          id: captain.id,
          companyId: captain.companyId,
          branchId: captain.branchId,
          zoneId: captain.zoneId,
          isActive: captain.isActive,
          availabilityStatus: captain.availabilityStatus,
          user: captain.user,
        },
        mode: "AUTO_DISTRIBUTION",
        captainLatestLocation: locMap.get(captain.id) ?? null,
        activeBlockingOrderCount: activeWorkingOrdersCount,
        autoDistributionPolicy: policy,
        applySuperAdminProximityGate: applyProxGate,
      });
      const finalEligibilityResult = eligibilityCore.allowed && !prepaidBlockReason;
      logAssignmentDecision("AUTO_CANDIDATE_RECHECK", {
        requestId,
        orderId,
        captainId: captain.id,
        assignmentPath: "automatic",
        activeBlockingOrderCount: activeWorkingOrdersCount,
        eligibilityResult: finalEligibilityResult,
        exclusionReason:
          !eligibilityCore.allowed
            ? eligibilityCore.reasonCode
            : prepaidBlockReason ?? null,
        overrideEnabled: policy === "OVERRIDE_MULTI_ORDER",
      });
      if (finalEligibilityResult) {
        selectedCaptain = captain;
        break;
      }

      const blockedCaptainId = captain.id;
      const idx = candidatePool.findIndex((c) => c.id === blockedCaptainId);
      if (idx >= 0) candidatePool.splice(idx, 1);
    }
    if (!selectedCaptain) {
      logAssignmentDecision("AUTO_NO_ELIGIBLE_AFTER_RECHECK", {
        requestId,
        orderId,
        captainId: null,
        assignmentPath: "automatic",
        activeBlockingOrderCount: null,
        eligibilityResult: false,
        exclusionReason: "AUTO_CAPACITY_RECHECK_BLOCKED_ALL",
        overrideEnabled: policy === "OVERRIDE_MULTI_ORDER",
      });
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.PENDING, assignedCaptainId: null },
      });
      await activityService.logTx(tx, actorUserId, "DISTRIBUTION_NO_ELIGIBLE_CAPTAINS", "order", orderId, {
        reason: "AUTO_CAPACITY_RECHECK_BLOCKED_ALL",
        policy,
      });
      return null;
    }

    const offerExpiresAt = expiredAtFromNow();
    const createdOfferLog = await tx.orderAssignmentLog.create({
      data: {
        orderId,
        captainId: selectedCaptain.id,
        assignmentType: $Enums.AssignmentType.AUTO,
        responseStatus: AssignmentResponseStatus.PENDING,
        expiredAt: offerExpiresAt,
      },
    });
    logOfferRowInsertedDiagnostics("AUTO_OFFER", orderId, selectedCaptain.id, createdOfferLog);
    logAssignmentCreated("AUTO_OFFER", {
      orderId,
      captainId: selectedCaptain.id,
      expiredAt: offerExpiresAt,
      assignmentType: "AUTO",
    });

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.ASSIGNED,
        assignedCaptainId: selectedCaptain.id,
      },
    });

    await notificationService.notifyCaptainTx(
      tx,
      selectedCaptain.userId,
      "ORDER_ASSIGNMENT_OFFER",
      "طلب — بانتظار قبولك",
      `طلب ${order.orderNumber}: لديك ${DISTRIBUTION_TIMEOUT_SECONDS} ثانية للقبول أو الانتقال للكابتن التالي.`,
    );

    await activityService.logTx(tx, actorUserId, "DISTRIBUTION_AUTO_OFFER", "order", orderId, {
      captainId: selectedCaptain.id,
      roundIndex: rounds,
      poolSize: candidatePool.length,
    });
      logAssignmentDecision("AUTO_CAPTAIN_SELECTED", {
        requestId,
        orderId,
        captainId: selectedCaptain.id,
        assignmentPath: "automatic",
        activeBlockingOrderCount: loadByCaptain.get(selectedCaptain.id) ?? 0,
        eligibilityResult: true,
        exclusionReason: null,
        overrideEnabled: policy === "OVERRIDE_MULTI_ORDER",
      });

    return { captainId: selectedCaptain.id };
  }

  async startAutoDistribution(
    orderId: string,
    actorUserId: string | null,
    engineCtx?: DistributionRequestContext,
  ) {
    return prisma.$transaction(async (tx) => {
      await lockOrderDistributionTx(tx, orderId);

      const order = await loadOrder(tx, orderId);
      assertOrderOperationalForDistribution(order);
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

      await this.offerNextAutoCaptainTx(
        tx,
        orderId,
        actorUserId,
        undefined,
        engineCtx?.requestId,
        engineCtx,
      );

      return tx.order.findUnique({ where: { id: orderId }, include: orderInclude });
    }, DISTRIBUTION_TRANSACTION_OPTIONS);
  }

  async startAutoDistributionVisible(
    orderId: string,
    actorUserId: string | null,
    requestId?: string,
    engineCtx?: DistributionRequestContext,
  ) {
    return prisma.$transaction(async (tx) => {
      await lockOrderDistributionTx(tx, orderId);
      const order = await loadOrder(tx, orderId);
      assertOrderOperationalForDistribution(order);
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
          notes: "Cancelled: start visible auto distribution",
        },
      });
      await tx.order.update({
        where: { id: orderId },
        data: { lastDistributionResetAt: new Date() },
      });
      await this.offerNextAutoCaptainTx(
        tx,
        orderId,
        actorUserId,
        { manualMultiOrderOverrideEnabled: true, overrideSource: "AUTO_VISIBLE_BATCH" },
        requestId,
        engineCtx,
      );
      return tx.order.findUnique({ where: { id: orderId }, include: orderInclude });
    }, DISTRIBUTION_TRANSACTION_OPTIONS);
  }

  async resendToDistribution(orderId: string, actorUserId: string | null, ctx: DistributionRequestContext = {}) {
    const t0 = Date.now();
    logEngineTiming("resend_distribution", "engine_enter", { requestId: ctx.requestId, orderId, actorUserId });
    try {
      return await prisma.$transaction(async (tx) => {
      logEngineTiming("resend_distribution", "transaction_enter", {
        requestId: ctx.requestId,
        orderId,
        actorUserId,
        totalMs: Date.now() - t0,
      });
      const txnStart = Date.now();
      await lockOrderDistributionTx(tx, orderId);
      logEngineTiming("resend_distribution", "advisory_lock_acquired", {
        requestId: ctx.requestId,
        orderId,
        txnMs: Date.now() - txnStart,
        totalMs: Date.now() - t0,
      });
      logEngineTiming("resend_distribution", "lock_acquired", {
        requestId: ctx.requestId,
        orderId,
        txnMs: Date.now() - txnStart,
        totalMs: Date.now() - t0,
      });

      const order = await loadOrder(tx, orderId);
      assertOrderOperationalForDistribution(order);
      logEngineTiming("resend_distribution", "order_lookup_and_checks_done", {
        requestId: ctx.requestId,
        orderId,
        actorUserId,
        orderStatus: order.status,
        totalMs: Date.now() - t0,
      });

      await tx.orderAssignmentLog.updateMany({
        where: { orderId, responseStatus: AssignmentResponseStatus.PENDING },
        data: {
          responseStatus: AssignmentResponseStatus.CANCELLED,
          notes: "Cancelled: resend to distribution",
        },
      });
      logEngineTiming("resend_distribution", "pending_logs_cancelled", {
        requestId: ctx.requestId,
        orderId,
        actorUserId,
        totalMs: Date.now() - t0,
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
      logEngineTiming("resend_distribution", "order_reset_written", {
        requestId: ctx.requestId,
        orderId,
        actorUserId,
        totalMs: Date.now() - t0,
      });

      await activityService.logTx(tx, actorUserId, "ORDER_RESEND_DISTRIBUTION", "order", orderId, {});
      logEngineTiming("resend_distribution", "activity_log_written", {
        requestId: ctx.requestId,
        orderId,
        actorUserId,
        totalMs: Date.now() - t0,
      });

      await this.offerNextAutoCaptainTx(tx, orderId, actorUserId, undefined, ctx.requestId, ctx);
      logEngineTiming("resend_distribution", "offer_next_auto_done", {
        requestId: ctx.requestId,
        orderId,
        actorUserId,
        totalMs: Date.now() - t0,
      });

      const finalOrder = await tx.order.findUnique({ where: { id: orderId }, include: orderInclude });
      logEngineTiming("resend_distribution", "final_order_loaded", {
        requestId: ctx.requestId,
        orderId,
        actorUserId,
        totalMs: Date.now() - t0,
      });
      return finalOrder;
      }, DISTRIBUTION_TRANSACTION_OPTIONS);
    } catch (error) {
      logEngineTiming("resend_distribution", "engine_error", {
        requestId: ctx.requestId,
        orderId,
        actorUserId,
        totalMs: Date.now() - t0,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async cancelCaptainAssignment(orderId: string, actorUserId: string | null) {
    return prisma.$transaction(async (tx) => {
      await lockOrderDistributionTx(tx, orderId);
      const order = await loadOrder(tx, orderId);
      assertOrderOperationalForDistribution(order);

      if (!order.assignedCaptainId) {
        throw new AppError(409, "Order has no assigned captain", "INVALID_STATE");
      }

      if (order.status === OrderStatus.DELIVERED || order.status === OrderStatus.CANCELLED) {
        throw new AppError(409, "Cannot cancel captain on closed order", "INVALID_STATE");
      }

      const previousOrderStatus = order.status;
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
      return { order: nextOrder, cancelledCaptainUserId, previousOrderStatus };
    }, DISTRIBUTION_TRANSACTION_OPTIONS);
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
    ctx: DistributionRequestContext = {},
  ) {
    const tAssign0 = Date.now();
    const profileAssign = process.env.ASSIGN_TIMING_PROFILE === "1";
    logEngineTiming("manual_assign", "engine_enter", {
      requestId: ctx.requestId,
      orderId,
      captainId,
      actorUserId,
      assignmentType,
    });
    try {
      return await prisma.$transaction(async (tx) => {
      logEngineTiming("manual_assign", "transaction_enter", {
        requestId: ctx.requestId,
        orderId,
        captainId,
        actorUserId,
        assignmentType,
        totalMs: Date.now() - tAssign0,
      });
      if (profileAssign) {
        // eslint-disable-next-line no-console
        console.info("[assign-timing-profile] txn entered", { orderId, deltaMs: Date.now() - tAssign0 });
      }
      await lockOrderDistributionTx(tx, orderId);
      logEngineTiming("manual_assign", "advisory_lock_acquired", {
        requestId: ctx.requestId,
        orderId,
        captainId,
        actorUserId,
        totalMs: Date.now() - tAssign0,
      });
      logEngineTiming("manual_assign", "lock_acquired", {
        requestId: ctx.requestId,
        orderId,
        captainId,
        actorUserId,
        totalMs: Date.now() - tAssign0,
      });
      if (profileAssign) {
        // eslint-disable-next-line no-console
        console.info("[assign-timing-profile] after pg_advisory_xact_lock", { orderId, deltaMs: Date.now() - tAssign0 });
      }

      const order = await loadOrder(tx, orderId);
      assertOrderOperationalForDistribution(order);
      logEngineTiming("manual_assign", "order_lookup_and_checks_done", {
        requestId: ctx.requestId,
        orderId,
        captainId,
        actorUserId,
        orderStatus: order.status,
        totalMs: Date.now() - tAssign0,
      });
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
      if (!captain) {
        throw new AppError(400, "Captain not eligible for manual assignment", "CAPTAIN_UNAVAILABLE");
      }
      const activeBlockingOrderCount = await tx.order.count({
        where: {
          assignedCaptainId: captain.id,
          status: { in: CAPTAIN_ACTIVE_WORKING_ORDER_STATUSES },
        },
      });
      const locMapManual = await loadLatestCaptainLocationsTx(tx, [captain.id]);
      const prepaidGatingSettingsManual =
        await captainPrepaidBalanceService.ensurePrepaidDashboardSettingsTx(tx);
      const platformSaManual = isSuperAdminPlatformOrder(order.createdBy?.role ?? null);
      const applyProxManual =
        platformSaManual && order.pickupLat != null && order.pickupLng != null;
      const actorForManual: AppRole = ctx.actorRole ?? UserRole.DISPATCHER;
      const eligibilityCore = canAssignCaptainToOrder({
        actor: { role: actorForManual },
        order: {
          companyId: order.companyId,
          branchId: order.branchId,
          zoneId: order.zoneId ?? null,
          pickupLat: order.pickupLat ?? null,
          pickupLng: order.pickupLng ?? null,
          createdByRole: order.createdBy?.role ?? null,
        },
        captain: {
          id: captain.id,
          companyId: captain.companyId,
          branchId: captain.branchId,
          zoneId: captain.zoneId,
          isActive: captain.isActive,
          availabilityStatus: captain.availabilityStatus,
          user: captain.user,
        },
        mode: "MANUAL_OVERRIDE",
        captainLatestLocation: locMapManual.get(captain.id) ?? null,
        activeBlockingOrderCount,
        applySuperAdminProximityGate: applyProxManual,
      });
      const prepaidBlockReason = await captainPrepaidBalanceService.getReceivingBlockReasonTx(
        tx,
        captain.id,
        prepaidGatingSettingsManual,
      );
      const finalManualEligible = eligibilityCore.allowed && !prepaidBlockReason;
      logAssignmentDecision("MANUAL_CAPTAIN_ELIGIBILITY", {
        requestId: ctx.requestId,
        orderId,
        captainId,
        assignmentPath: "manual",
        activeBlockingOrderCount,
        eligibilityResult: finalManualEligible,
        exclusionReason:
          !eligibilityCore.allowed ? eligibilityCore.reasonCode : prepaidBlockReason ?? null,
        overrideEnabled: true,
      });
      if (process.env.ASSIGN_ELIGIBILITY_AUDIT === "1") {
        logAssignmentEligibilityAudit("MANUAL_ASSIGN", {
          orderNumber: order.orderNumber,
          orderCompanyId: order.companyId,
          orderBranchId: order.branchId,
          actorRole: actorForManual,
          pickupLat: order.pickupLat ?? null,
          pickupLng: order.pickupLng ?? null,
          captainName: captain.user.fullName,
          captainPhone: captain.user.phone,
          captainCompanyId: captain.companyId,
          captainBranchId: captain.branchId,
          distanceMeters: eligibilityCore.distanceMeters,
          allowed: finalManualEligible,
          reasonCode: finalManualEligible
            ? "OK"
            : !eligibilityCore.allowed
              ? eligibilityCore.reasonCode
              : "CAPTAIN_UNAVAILABLE",
        });
      }
      assertAssignmentEligibilityOrThrow(eligibilityCore);
      const targetCaptain = captain;
      if (
        !ctx.bypassOrderOwnerCaptainFleetForCompanyAdmin &&
        order.ownerUserId &&
        targetCaptain.createdByUserId !== order.ownerUserId
      ) {
        throw new AppError(403, "Captain does not belong to this order owner's fleet.", "OWNER_MISMATCH");
      }
      if (!ctx.bypassSupervisorLinkScope) {
        await assertCaptainSupervisorScopeForOrderTx(tx, order, {
          supervisorUserId: targetCaptain.supervisorUserId ?? null,
        });
      }
      await captainPrepaidBalanceService.assertCanReceiveOrderTx(tx, captain.id, {
        assignmentPath: "manual",
        allowManualOverride: true,
        prepaidSettings: prepaidGatingSettingsManual,
      });
      logEngineTiming("manual_assign", "captain_lookup_and_checks_done", {
        requestId: ctx.requestId,
        orderId,
        captainId,
        actorUserId,
        totalMs: Date.now() - tAssign0,
      });

      await tx.orderAssignmentLog.updateMany({
        where: { orderId, responseStatus: AssignmentResponseStatus.PENDING },
        data: {
          responseStatus: AssignmentResponseStatus.CANCELLED,
          notes: `Cancelled: ${String(assignmentType).toLowerCase()} override`,
        },
      });
      logEngineTiming("manual_assign", "pending_logs_cancelled", {
        requestId: ctx.requestId,
        orderId,
        captainId,
        actorUserId,
        totalMs: Date.now() - tAssign0,
      });

      const manualExpiresAt = expiredAtFromNow();
      const createdManualLog = await tx.orderAssignmentLog.create({
        data: {
          orderId,
          captainId: targetCaptain.id,
          assignmentType,
          responseStatus: AssignmentResponseStatus.PENDING,
          expiredAt: manualExpiresAt,
        },
      });
      logOfferRowInsertedDiagnostics(
        assignmentType === $Enums.AssignmentType.DRAG_DROP ? "DRAG_DROP" : "MANUAL",
        orderId,
        targetCaptain.id,
        createdManualLog,
      );
      logAssignmentCreated(assignmentType === $Enums.AssignmentType.DRAG_DROP ? "DRAG_DROP" : "MANUAL", {
        orderId,
        captainId: targetCaptain.id,
        expiredAt: manualExpiresAt,
        assignmentType: String(assignmentType),
      });
      logEngineTiming("manual_assign", "assignment_log_created", {
        requestId: ctx.requestId,
        orderId,
        captainId,
        actorUserId,
        totalMs: Date.now() - tAssign0,
      });

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.ASSIGNED,
          assignedCaptainId: targetCaptain.id,
          distributionMode: DistributionMode.MANUAL,
        },
      });
      logEngineTiming("manual_assign", "order_updated_assigned", {
        requestId: ctx.requestId,
        orderId,
        captainId,
        actorUserId,
        totalMs: Date.now() - tAssign0,
      });

      await notificationService.notifyCaptainTx(
        tx,
        targetCaptain.userId,
        "ORDER_ASSIGNMENT_OFFER",
        assignmentType === $Enums.AssignmentType.DRAG_DROP ? "تعيين (سحب وإفلات)" : "تعيين يدوي",
        `تم تعيينك للطلب ${order.orderNumber}. يرجى الرد خلال ${DISTRIBUTION_TIMEOUT_SECONDS} ثانية.`,
      );
      logEngineTiming("manual_assign", "notification_written", {
        requestId: ctx.requestId,
        orderId,
        captainId,
        actorUserId,
        totalMs: Date.now() - tAssign0,
      });

      await activityService.logTx(tx, actorUserId, "ORDER_MANUAL_ASSIGN", "order", orderId, {
        captainId,
        assignmentType,
      });
      logEngineTiming("manual_assign", "activity_log_written", {
        requestId: ctx.requestId,
        orderId,
        captainId,
        actorUserId,
        totalMs: Date.now() - tAssign0,
      });

      if (profileAssign) {
        // eslint-disable-next-line no-console
        console.info("[assign-timing-profile] before final order.findUnique", { orderId, deltaMs: Date.now() - tAssign0 });
      }
      const finalOrder = await tx.order.findUnique({ where: { id: orderId }, include: orderInclude });
      logEngineTiming("manual_assign", "final_order_loaded", {
        requestId: ctx.requestId,
        orderId,
        captainId,
        actorUserId,
        totalMs: Date.now() - tAssign0,
      });
      return finalOrder;
      }, DISTRIBUTION_TRANSACTION_OPTIONS);
    } catch (error) {
      logEngineTiming("manual_assign", "engine_error", {
        requestId: ctx.requestId,
        orderId,
        captainId,
        actorUserId,
        totalMs: Date.now() - tAssign0,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async reassign(orderId: string, captainId: string, actorUserId: string | null, ctx: DistributionRequestContext = {}) {
    const t0 = Date.now();
    logEngineTiming("reassign", "engine_enter", { requestId: ctx.requestId, orderId, captainId, actorUserId });
    try {
      return await prisma.$transaction(async (tx) => {
      logEngineTiming("reassign", "transaction_enter", {
        requestId: ctx.requestId,
        orderId,
        captainId,
        actorUserId,
        totalMs: Date.now() - t0,
      });
      const txnStart = Date.now();
      await lockOrderDistributionTx(tx, orderId);
      logEngineTiming("reassign", "advisory_lock_acquired", {
        requestId: ctx.requestId,
        orderId,
        captainId,
        actorUserId,
        txnMs: Date.now() - txnStart,
        totalMs: Date.now() - t0,
      });
      logEngineTiming("reassign", "lock_acquired", {
        requestId: ctx.requestId,
        orderId,
        captainId,
        actorUserId,
        txnMs: Date.now() - txnStart,
        totalMs: Date.now() - t0,
      });

      const order = await loadOrder(tx, orderId);
      assertOrderOperationalForDistribution(order);
      logEngineTiming("reassign", "order_lookup_and_checks_done", {
        requestId: ctx.requestId,
        orderId,
        captainId,
        actorUserId,
        orderStatus: order.status,
        totalMs: Date.now() - t0,
      });

      const captain = await tx.captain.findUnique({
        where: { id: captainId },
        include: { user: true },
      });
      if (!captain) {
        throw new AppError(400, "Captain not eligible for reassignment", "CAPTAIN_UNAVAILABLE");
      }
      const activeBlockingOrderCount = await tx.order.count({
        where: {
          assignedCaptainId: captain.id,
          status: { in: CAPTAIN_ACTIVE_WORKING_ORDER_STATUSES },
        },
      });
      const locMapReassign = await loadLatestCaptainLocationsTx(tx, [captain.id]);
      const prepaidGatingSettingsReassign =
        await captainPrepaidBalanceService.ensurePrepaidDashboardSettingsTx(tx);
      const platformSaReassign = isSuperAdminPlatformOrder(order.createdBy?.role ?? null);
      const applyProxReassign =
        platformSaReassign && order.pickupLat != null && order.pickupLng != null;
      const actorForReassign: AppRole = ctx.actorRole ?? UserRole.DISPATCHER;
      const eligibilityCoreRe = canAssignCaptainToOrder({
        actor: { role: actorForReassign },
        order: {
          companyId: order.companyId,
          branchId: order.branchId,
          zoneId: order.zoneId ?? null,
          pickupLat: order.pickupLat ?? null,
          pickupLng: order.pickupLng ?? null,
          createdByRole: order.createdBy?.role ?? null,
        },
        captain: {
          id: captain.id,
          companyId: captain.companyId,
          branchId: captain.branchId,
          zoneId: captain.zoneId,
          isActive: captain.isActive,
          availabilityStatus: captain.availabilityStatus,
          user: captain.user,
        },
        mode: "REASSIGN",
        captainLatestLocation: locMapReassign.get(captain.id) ?? null,
        activeBlockingOrderCount,
        applySuperAdminProximityGate: applyProxReassign,
      });
      const prepaidBlockReason = await captainPrepaidBalanceService.getReceivingBlockReasonTx(
        tx,
        captain.id,
        prepaidGatingSettingsReassign,
      );
      const finalReassignEligible = eligibilityCoreRe.allowed && !prepaidBlockReason;
      logAssignmentDecision("REASSIGN_CAPTAIN_ELIGIBILITY", {
        requestId: ctx.requestId,
        orderId,
        captainId,
        assignmentPath: "manual",
        activeBlockingOrderCount,
        eligibilityResult: finalReassignEligible,
        exclusionReason:
          !eligibilityCoreRe.allowed ? eligibilityCoreRe.reasonCode : prepaidBlockReason ?? null,
        overrideEnabled: true,
      });
      if (process.env.ASSIGN_ELIGIBILITY_AUDIT === "1") {
        logAssignmentEligibilityAudit("REASSIGN", {
          orderNumber: order.orderNumber,
          orderCompanyId: order.companyId,
          orderBranchId: order.branchId,
          actorRole: actorForReassign,
          pickupLat: order.pickupLat ?? null,
          pickupLng: order.pickupLng ?? null,
          captainName: captain.user.fullName,
          captainPhone: captain.user.phone,
          captainCompanyId: captain.companyId,
          captainBranchId: captain.branchId,
          distanceMeters: eligibilityCoreRe.distanceMeters,
          allowed: finalReassignEligible,
          reasonCode: finalReassignEligible
            ? "OK"
            : !eligibilityCoreRe.allowed
              ? eligibilityCoreRe.reasonCode
              : "CAPTAIN_UNAVAILABLE",
        });
      }
      assertAssignmentEligibilityOrThrow(eligibilityCoreRe);
      const targetCaptain = captain;
      if (
        !ctx.bypassOrderOwnerCaptainFleetForCompanyAdmin &&
        order.ownerUserId &&
        targetCaptain.createdByUserId !== order.ownerUserId
      ) {
        throw new AppError(403, "Captain does not belong to this order owner's fleet.", "OWNER_MISMATCH");
      }
      if (!ctx.bypassSupervisorLinkScope) {
        await assertCaptainSupervisorScopeForOrderTx(tx, order, {
          supervisorUserId: targetCaptain.supervisorUserId ?? null,
        });
      }
      await captainPrepaidBalanceService.assertCanReceiveOrderTx(tx, captain.id, {
        assignmentPath: "manual",
        allowManualOverride: true,
        prepaidSettings: prepaidGatingSettingsReassign,
      });
      logEngineTiming("reassign", "captain_lookup_and_checks_done", {
        requestId: ctx.requestId,
        orderId,
        captainId,
        actorUserId,
        totalMs: Date.now() - t0,
      });

      await tx.orderAssignmentLog.updateMany({
        where: { orderId, responseStatus: AssignmentResponseStatus.PENDING },
        data: {
          responseStatus: AssignmentResponseStatus.CANCELLED,
          notes: "Cancelled: reassign",
        },
      });
      logEngineTiming("reassign", "pending_logs_cancelled", {
        requestId: ctx.requestId,
        orderId,
        captainId,
        actorUserId,
        totalMs: Date.now() - t0,
      });

      const reassignExpiresAt = expiredAtFromNow();
      const createdReassignLog = await tx.orderAssignmentLog.create({
        data: {
          orderId,
          captainId: targetCaptain.id,
          assignmentType: $Enums.AssignmentType.REASSIGN,
          responseStatus: AssignmentResponseStatus.PENDING,
          expiredAt: reassignExpiresAt,
        },
      });
      logOfferRowInsertedDiagnostics("REASSIGN", orderId, targetCaptain.id, createdReassignLog);
      logAssignmentCreated("REASSIGN", {
        orderId,
        captainId: targetCaptain.id,
        expiredAt: reassignExpiresAt,
        assignmentType: "REASSIGN",
      });
      logEngineTiming("reassign", "assignment_log_created", {
        requestId: ctx.requestId,
        orderId,
        captainId,
        actorUserId,
        totalMs: Date.now() - t0,
      });

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.ASSIGNED,
          assignedCaptainId: targetCaptain.id,
        },
      });
      logEngineTiming("reassign", "order_updated_assigned", {
        requestId: ctx.requestId,
        orderId,
        captainId,
        actorUserId,
        totalMs: Date.now() - t0,
      });

      await notificationService.notifyCaptainTx(
        tx,
        targetCaptain.userId,
        "ORDER_REASSIGNED",
        "إعادة تعيين",
        `تم إعادة تعيينك للطلب ${order.orderNumber}.`,
      );
      logEngineTiming("reassign", "notification_written", {
        requestId: ctx.requestId,
        orderId,
        captainId,
        actorUserId,
        totalMs: Date.now() - t0,
      });

      await activityService.logTx(tx, actorUserId, "ORDER_REASSIGNED", "order", orderId, { captainId });
      logEngineTiming("reassign", "activity_log_written", {
        requestId: ctx.requestId,
        orderId,
        captainId,
        actorUserId,
        totalMs: Date.now() - t0,
      });

      const finalOrder = await tx.order.findUnique({ where: { id: orderId }, include: orderInclude });
      logEngineTiming("reassign", "final_order_loaded", {
        requestId: ctx.requestId,
        orderId,
        captainId,
        actorUserId,
        totalMs: Date.now() - t0,
      });
      return finalOrder;
      }, DISTRIBUTION_TRANSACTION_OPTIONS);
    } catch (error) {
      logEngineTiming("reassign", "engine_error", {
        requestId: ctx.requestId,
        orderId,
        captainId,
        actorUserId,
        totalMs: Date.now() - t0,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

export const distributionEngine = new DistributionEngine();
