import { CaptainBalanceTransactionType, OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/errors.js";
import { activityService } from "./activity.service.js";

type Tx = Prisma.TransactionClient;

const SETTINGS_ID = "default" as const;
const ZERO = new Prisma.Decimal(0);

function money(value: Prisma.Decimal.Value): Prisma.Decimal {
  return new Prisma.Decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

function percent(value: Prisma.Decimal.Value): Prisma.Decimal {
  return new Prisma.Decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

function decString(value: Prisma.Decimal.Value): string {
  return money(value).toFixed(2);
}

function deliveryFeeFromOrder(order: { cashCollection: Prisma.Decimal }): Prisma.Decimal {
  // Current order model stores the delivery fee submitted by dashboard forms in cashCollection.
  return money(order.cashCollection);
}

async function getSettingsTx(tx: Tx) {
  return tx.dashboardSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID },
    update: {},
  });
}

function resolvePolicy(
  settings: Awaited<ReturnType<typeof getSettingsTx>>,
  captain: {
    prepaidBalance: Prisma.Decimal;
    commissionPercent: Prisma.Decimal | null;
    prepaidEnabled: boolean;
    minimumBalanceToReceiveOrders: Prisma.Decimal | null;
  },
) {
  const systemEnabled = settings.prepaidCaptainsEnabled;
  const captainEnabled = captain.prepaidEnabled;
  const effectiveEnabled = systemEnabled && captainEnabled;
  const commissionPercent = percent(
    settings.prepaidAllowCaptainCustomCommission && captain.commissionPercent != null
      ? captain.commissionPercent
      : settings.prepaidDefaultCommissionPercent,
  );
  const minimumBalance = money(
    captain.minimumBalanceToReceiveOrders ?? settings.prepaidMinimumBalanceToReceiveOrders ?? ZERO,
  );
  const balance = money(captain.prepaidBalance);
  const blockedFromReceivingOrders = effectiveEnabled && (balance.lte(0) || balance.lt(minimumBalance));
  const lowBalance = effectiveEnabled && !blockedFromReceivingOrders && balance.lte(minimumBalance.plus(10));

  return {
    systemEnabled,
    captainEnabled,
    prepaidEnabled: effectiveEnabled,
    commissionPercent,
    minimumBalance,
    currentBalance: balance,
    lowBalance,
    blockedFromReceivingOrders,
    blockReason: blockedFromReceivingOrders
      ? balance.lte(0)
        ? "PREPAID_BALANCE_DEPLETED"
        : "PREPAID_BALANCE_BELOW_MINIMUM"
      : null,
    manualAssignmentOverrideAllowed: settings.prepaidAllowManualAssignmentOverride,
  };
}

async function loadCaptainPolicyTx(tx: Tx, captainId: string) {
  const settings = await getSettingsTx(tx);
  const captain = await tx.captain.findUnique({
    where: { id: captainId },
    select: {
      id: true,
      userId: true,
      prepaidBalance: true,
      commissionPercent: true,
      prepaidEnabled: true,
      totalCharged: true,
      totalDeducted: true,
      minimumBalanceToReceiveOrders: true,
      lastBalanceUpdatedAt: true,
    },
  });
  if (!captain) throw new AppError(404, "Captain not found", "NOT_FOUND");
  return { settings, captain, policy: resolvePolicy(settings, captain) };
}

function summaryDto(input: {
  captain: {
    id: string;
    prepaidBalance: Prisma.Decimal;
    commissionPercent: Prisma.Decimal | null;
    prepaidEnabled: boolean;
    totalCharged: Prisma.Decimal;
    totalDeducted: Prisma.Decimal;
    minimumBalanceToReceiveOrders: Prisma.Decimal | null;
    lastBalanceUpdatedAt: Date | null;
  };
  policy: ReturnType<typeof resolvePolicy>;
  lastChargeAt?: Date | null;
  lastDeductionAt?: Date | null;
  estimatedRemainingOrders?: number | null;
}) {
  return {
    captainId: input.captain.id,
    currentBalance: decString(input.policy.currentBalance),
    prepaidBalance: decString(input.policy.currentBalance),
    commissionPercent: input.policy.commissionPercent.toFixed(2),
    prepaidEnabled: input.policy.prepaidEnabled,
    captainPrepaidEnabled: input.captain.prepaidEnabled,
    systemPrepaidEnabled: input.policy.systemEnabled,
    totalCharged: decString(input.captain.totalCharged),
    totalDeducted: decString(input.captain.totalDeducted),
    minimumBalanceToReceiveOrders: decString(input.policy.minimumBalance),
    lowBalance: input.policy.lowBalance,
    blockedFromReceivingOrders: input.policy.blockedFromReceivingOrders,
    blockReason: input.policy.blockReason,
    estimatedRemainingOrders: input.estimatedRemainingOrders ?? null,
    lastBalanceUpdatedAt: input.captain.lastBalanceUpdatedAt?.toISOString() ?? null,
    lastChargeAt: input.lastChargeAt?.toISOString() ?? null,
    lastDeductionAt: input.lastDeductionAt?.toISOString() ?? null,
    explanationText:
      "يتم خصم نسبة العمولة من رسوم التوصيل فقط بعد تسليم الطلب. لا يتم الخصم من الطلبات الملغاة أو غير المسلمة.",
  };
}

export const captainPrepaidBalanceService = {
  calculateCommission(deliveryFee: Prisma.Decimal.Value, commissionPercent: Prisma.Decimal.Value) {
    return money(new Prisma.Decimal(deliveryFee).mul(commissionPercent).div(100));
  },

  async getReceivingBlockReasonTx(tx: Tx, captainId: string): Promise<string | null> {
    const { policy } = await loadCaptainPolicyTx(tx, captainId);
    return policy.blockedFromReceivingOrders ? policy.blockReason : null;
  },

  async assertCanReceiveOrderTx(
    tx: Tx,
    captainId: string,
    opts: { assignmentPath: "automatic" | "manual"; allowManualOverride?: boolean },
  ) {
    const { policy } = await loadCaptainPolicyTx(tx, captainId);
    if (!policy.blockedFromReceivingOrders) return;
    if (
      opts.assignmentPath === "manual" &&
      opts.allowManualOverride &&
      policy.manualAssignmentOverrideAllowed
    ) {
      // eslint-disable-next-line no-console
      console.warn("[captain-prepaid] manual assignment override used", {
        captainId,
        reason: policy.blockReason,
        balance: policy.currentBalance.toFixed(2),
      });
      return;
    }
    throw new AppError(
      409,
      "الرصيد غير كافٍ لاستقبال طلبات جديدة",
      policy.blockReason ?? "PREPAID_BALANCE_BLOCKED",
    );
  },

  async deductForDeliveredOrderTx(tx: Tx, orderId: string, actorUserId: string | null) {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        cashCollection: true,
        assignedCaptainId: true,
      },
    });
    if (!order || order.status !== OrderStatus.DELIVERED || !order.assignedCaptainId) return null;

    const existing = await tx.captainBalanceTransaction.findFirst({
      where: {
        captainId: order.assignedCaptainId,
        orderId,
        type: CaptainBalanceTransactionType.DEDUCTION,
      },
      select: { id: true },
    });
    if (existing) return { skipped: true as const, reason: "ALREADY_DEDUCTED" as const };

    const { captain, policy } = await loadCaptainPolicyTx(tx, order.assignedCaptainId);
    if (!policy.prepaidEnabled) return { skipped: true as const, reason: "PREPAID_DISABLED" as const };

    const deliveryFee = deliveryFeeFromOrder(order);
    const commission = this.calculateCommission(deliveryFee, policy.commissionPercent);
    if (commission.lte(0)) return { skipped: true as const, reason: "ZERO_COMMISSION" as const };

    const nextBalance = money(captain.prepaidBalance.minus(commission));
    await tx.captain.update({
      where: { id: captain.id },
      data: {
        prepaidBalance: nextBalance,
        totalDeducted: { increment: commission },
        lastBalanceUpdatedAt: new Date(),
      },
    });

    const transaction = await tx.captainBalanceTransaction.create({
      data: {
        captainId: captain.id,
        type: CaptainBalanceTransactionType.DEDUCTION,
        amount: commission,
        balanceAfter: nextBalance,
        commissionPercentSnapshot: policy.commissionPercent,
        deliveryFeeSnapshot: deliveryFee,
        orderId,
        note: `تم خصم العمولة بعد تسليم الطلب ${order.orderNumber}`,
        createdBy: actorUserId,
      },
    });

    await activityService.logTx(tx, actorUserId, "CAPTAIN_PREPAID_DEDUCTED", "captain", captain.id, {
      orderId,
      orderNumber: order.orderNumber,
      deliveryFee: deliveryFee.toFixed(2),
      commissionPercent: policy.commissionPercent.toFixed(2),
      commission: commission.toFixed(2),
      balanceAfter: nextBalance.toFixed(2),
    });

    return transaction;
  },

  async chargeCaptain(captainId: string, input: { amount: number; note?: string }, actorUserId: string) {
    const amount = money(input.amount);
    if (amount.lte(0)) throw new AppError(400, "Amount must be greater than zero", "BAD_REQUEST");

    return prisma.$transaction(async (tx) => {
      const { captain, policy } = await loadCaptainPolicyTx(tx, captainId);
      const nextBalance = money(captain.prepaidBalance.plus(amount));
      const transaction = await tx.captainBalanceTransaction.create({
        data: {
          captainId,
          type: CaptainBalanceTransactionType.CHARGE,
          amount,
          balanceAfter: nextBalance,
          commissionPercentSnapshot: policy.commissionPercent,
          note: input.note?.trim() || "تم شحن الرصيد بنجاح",
          createdBy: actorUserId,
        },
      });
      await tx.captain.update({
        where: { id: captainId },
        data: {
          prepaidBalance: nextBalance,
          totalCharged: { increment: amount },
          lastBalanceUpdatedAt: new Date(),
        },
      });
      await activityService.logTx(tx, actorUserId, "CAPTAIN_PREPAID_CHARGED", "captain", captainId, {
        amount: amount.toFixed(2),
        balanceAfter: nextBalance.toFixed(2),
        note: input.note ?? null,
      });
      return transaction;
    });
  },

  async adjustCaptain(captainId: string, input: { amount: number; note: string }, actorUserId: string) {
    const amount = money(input.amount);
    if (amount.eq(0)) throw new AppError(400, "Adjustment amount cannot be zero", "BAD_REQUEST");
    if (!input.note.trim()) throw new AppError(400, "Adjustment note is required", "BAD_REQUEST");

    return prisma.$transaction(async (tx) => {
      const { captain, policy } = await loadCaptainPolicyTx(tx, captainId);
      const nextBalance = money(captain.prepaidBalance.plus(amount));
      const transaction = await tx.captainBalanceTransaction.create({
        data: {
          captainId,
          type: CaptainBalanceTransactionType.ADJUSTMENT,
          amount,
          balanceAfter: nextBalance,
          commissionPercentSnapshot: policy.commissionPercent,
          note: input.note.trim(),
          createdBy: actorUserId,
        },
      });
      await tx.captain.update({
        where: { id: captainId },
        data: {
          prepaidBalance: nextBalance,
          lastBalanceUpdatedAt: new Date(),
        },
      });
      await activityService.logTx(tx, actorUserId, "CAPTAIN_PREPAID_ADJUSTED", "captain", captainId, {
        amount: amount.toFixed(2),
        balanceAfter: nextBalance.toFixed(2),
        note: input.note,
      });
      return transaction;
    });
  },

  async getSummary(captainId: string) {
    return prisma.$transaction(async (tx) => {
      const { captain, policy } = await loadCaptainPolicyTx(tx, captainId);
      const [lastCharge, lastDeduction, deliveredAvg] = await Promise.all([
        tx.captainBalanceTransaction.findFirst({
          where: { captainId, type: CaptainBalanceTransactionType.CHARGE },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
        tx.captainBalanceTransaction.findFirst({
          where: { captainId, type: CaptainBalanceTransactionType.DEDUCTION },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
        tx.order.aggregate({
          where: { assignedCaptainId: captainId, status: OrderStatus.DELIVERED },
          _avg: { cashCollection: true },
        }),
      ]);
      const averageDeliveryFee = money(deliveredAvg._avg.cashCollection ?? 0);
      const estimatedCommission = this.calculateCommission(averageDeliveryFee, policy.commissionPercent);
      const estimatedRemainingOrders = estimatedCommission.gt(0)
        ? Math.max(0, Math.floor(policy.currentBalance.div(estimatedCommission).toNumber()))
        : null;

      return summaryDto({
        captain,
        policy,
        lastChargeAt: lastCharge?.createdAt ?? null,
        lastDeductionAt: lastDeduction?.createdAt ?? null,
        estimatedRemainingOrders,
      });
    });
  },

  async listTransactions(captainId: string, params: { page: number; pageSize: number }) {
    const page = Math.max(1, params.page);
    const pageSize = Math.min(100, Math.max(1, params.pageSize));
    const [total, items] = await prisma.$transaction([
      prisma.captainBalanceTransaction.count({ where: { captainId } }),
      prisma.captainBalanceTransaction.findMany({
        where: { captainId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      total,
      page,
      pageSize,
      items: items.map((row) => ({
        id: row.id,
        captainId: row.captainId,
        type: row.type.toLowerCase(),
        amount: decString(row.amount),
        balanceAfter: decString(row.balanceAfter),
        commissionPercentSnapshot: row.commissionPercentSnapshot?.toFixed(2) ?? null,
        deliveryFeeSnapshot: row.deliveryFeeSnapshot ? decString(row.deliveryFeeSnapshot) : null,
        orderId: row.orderId,
        note: row.note,
        createdBy: row.createdBy,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  },
};
