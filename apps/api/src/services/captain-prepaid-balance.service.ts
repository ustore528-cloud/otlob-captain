import {
  CaptainBalanceTransactionType,
  LedgerEntryType,
  OrderStatus,
  Prisma,
  WalletOwnerType,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import {
  CAPTAIN_PREPAID_LEDGER_MUTATION_TX_OPTIONS,
  LEDGER_REF_CAPTAIN_PREPAID_OP,
  financePrepaidChargeClientIdempotencyKey,
  prepaidAdjustLedgerIdempotencyKey,
  prepaidChargeLedgerIdempotencyKey,
} from "../config/captain-prepaid-ledger.js";
import { isCompanyAdminRole, isSuperAdminRole, type AppRole } from "../lib/rbac-roles.js";
import type { CaptainBalanceTransaction, DashboardSettings } from "@prisma/client";
import {
  DISTRIBUTION_GATING_SHADOW_LOG,
  DISTRIBUTION_GATING_USE_ALIGNED_BALANCE,
} from "../config/distribution-gating-flags.js";
import { ORDER_DELIVERED_LEDGER_HOOK_ENABLED } from "../config/order-ledger-flags.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/errors.js";
import { activityService } from "./activity.service.js";
import { buildCaptainReadAlignment, getBalanceForPrepaidProductChecks } from "./captain-read-alignment.js";
import { appendLedgerEntryInTx, ensureWalletAccountInTx } from "./ledger/index.js";
import {
  resolveDeliveryFeeForCommission,
  resolveDeliverySettlementFromDeliveryFee,
  resolveEffectivePlatformCommissionPercent,
} from "../domain/order-delivery-fee-for-commission.js";
import { getOrCreateCompanyWallet } from "./company-wallet.service.js";

/** Company wallet debit leg for CA → captain prepaid (pairs with captain `CAPTAIN_PREPAID_CHARGE` leg). */
export const COMPANY_ADMIN_CAPTAIN_CO_DEBIT_PREFIX = "ca31:co-to-captain:co-debit" as const;

export function buildCompanyAdminCaptainCoDebitIdempotencyKey(
  companyId: string,
  captainId: string,
  clientIdempotencyKey: string,
): string {
  return `${COMPANY_ADMIN_CAPTAIN_CO_DEBIT_PREFIX}:${companyId}:${captainId}:${clientIdempotencyKey.trim()}`;
}

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
  /** Must match read-alignment display rule when `DISTRIBUTION_GATING_USE_ALIGNED_BALANCE` (see `getBalanceForPrepaidProductChecks`). */
  balanceForPrepaidProductChecks: Prisma.Decimal,
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
  const balance = money(balanceForPrepaidProductChecks);
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

async function loadCaptainPolicyWithSettingsTx(tx: Tx, captainId: string, settings: DashboardSettings) {
  const captain = await tx.captain.findUnique({
    where: { id: captainId },
    select: {
      id: true,
      userId: true,
      companyId: true,
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
  const wallet = await tx.walletAccount.findUnique({
    where: { ownerType_ownerId: { ownerType: WalletOwnerType.CAPTAIN, ownerId: captainId } },
    select: { balanceCached: true },
  });
  const balanceForPrepaidProductChecks = getBalanceForPrepaidProductChecks({
    useAligned: DISTRIBUTION_GATING_USE_ALIGNED_BALANCE,
    captainPrepaid: captain.prepaidBalance,
    walletBalanceCached: wallet?.balanceCached ?? null,
  });
  if (DISTRIBUTION_GATING_SHADOW_LOG && wallet) {
    const p = money(captain.prepaidBalance);
    const w = money(wallet.balanceCached);
    if (!p.equals(w)) {
      // eslint-disable-next-line no-console
      console.warn("[captain-prepaid] gating balance shadow (prepaid ≠ wallet)", {
        captainId,
        prepaid: p.toFixed(2),
        wallet: w.toFixed(2),
        gating: money(balanceForPrepaidProductChecks).toFixed(2),
        useAligned: DISTRIBUTION_GATING_USE_ALIGNED_BALANCE,
      });
    }
  }
  return { settings, captain, policy: resolvePolicy(settings, captain, balanceForPrepaidProductChecks) };
}

async function loadCaptainPolicyTx(tx: Tx, captainId: string) {
  const settings = await getSettingsTx(tx);
  return loadCaptainPolicyWithSettingsTx(tx, captainId, settings);
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
    /** Prepaid *book* (`Captain.prepaidBalance`); `currentBalance` follows policy (aligned with wallet when gating flag on). */
    prepaidBalance: decString(input.captain.prepaidBalance),
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
      "يتم خصم من رصيد الكابتن بعد التسليم وفق رسوم التوصيل فقط: الخصم = رسوم التوصيل − صافي حصة الكابتن الثابتة؛ عمولة المنصّة نسبة من رسوم التوصيل؛ لا يُستخدم سعر البضاعة. لا خصم للطلبات الملغاة أو غير المسلمة.",
  };
}

export const captainPrepaidBalanceService = {
  calculateCommission(deliveryFee: Prisma.Decimal.Value, commissionPercent: Prisma.Decimal.Value) {
    return money(new Prisma.Decimal(deliveryFee).mul(commissionPercent).div(100));
  },

  /**
   * Global prepaid gating flags live on `dashboard_settings` (single row). Call **once** per interactive
   * transaction that evaluates many captains — each `getReceivingBlockReasonTx` used to `upsert` per captain.
   */
  ensurePrepaidDashboardSettingsTx(tx: Tx): Promise<DashboardSettings> {
    return getSettingsTx(tx);
  },

  async getReceivingBlockReasonTx(
    tx: Tx,
    captainId: string,
    prepaidSettings?: DashboardSettings,
  ): Promise<string | null> {
    const settings = prepaidSettings ?? (await getSettingsTx(tx));
    const { policy } = await loadCaptainPolicyWithSettingsTx(tx, captainId, settings);
    return policy.blockedFromReceivingOrders ? policy.blockReason : null;
  },

  async assertCanReceiveOrderTx(
    tx: Tx,
    captainId: string,
    opts: {
      assignmentPath: "automatic" | "manual";
      allowManualOverride?: boolean;
      /** When already loaded for this tx (e.g. auto pool), avoids repeated settings upsert. */
      prepaidSettings?: DashboardSettings;
    },
  ) {
    const settings = opts.prepaidSettings ?? (await getSettingsTx(tx));
    const { policy } = await loadCaptainPolicyWithSettingsTx(tx, captainId, settings);
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

  /**
   * Settlement for a delivered order on the unified ledger: deduction from captain =
   * `deliveryFee − captainFixedSharePerDelivery` (min 0); platform commission = `% × deliveryFee`.
   * Ignores `prepaidEnabled` for ledger posting; mirror uses prepaid flag separately.
   */
  async resolveDeliveredCommissionForLedgerTx(
    tx: Tx,
    order: {
      assignedCaptainId: string | null;
      amount: Prisma.Decimal;
      deliveryFee: Prisma.Decimal | null;
      cashCollection: Prisma.Decimal;
    },
  ): Promise<{
    captainBalanceDeduction: Prisma.Decimal;
    platformCommission: Prisma.Decimal;
    companyProfit: Prisma.Decimal;
    captainNetShare: Prisma.Decimal;
    captainId: string;
    deliveryFee: Prisma.Decimal;
    commissionPercent: Prisma.Decimal;
  } | null> {
    if (!order.assignedCaptainId) return null;
    const { captain } = await loadCaptainPolicyTx(tx, order.assignedCaptainId);
    const settings = await getSettingsTx(tx);
    const deliveryFee = resolveDeliveryFeeForCommission(order);
    const commissionPercent = resolveEffectivePlatformCommissionPercent({
      prepaidAllowCaptainCustomCommission: settings.prepaidAllowCaptainCustomCommission,
      prepaidDefaultCommissionPercent: settings.prepaidDefaultCommissionPercent,
      captainCommissionPercentOverride: captain.commissionPercent,
    });
    const settlement = resolveDeliverySettlementFromDeliveryFee({
      deliveryFee,
      platformCommissionPercent: commissionPercent,
      captainFixedSharePerDelivery: settings.captainFixedSharePerDelivery,
    });
    if (settlement.captainBalanceDeduction.lte(ZERO)) return null;
    return {
      captainBalanceDeduction: settlement.captainBalanceDeduction,
      platformCommission: settlement.platformCommission,
      companyProfit: settlement.companyProfit,
      captainNetShare: settlement.captainNetShare,
      captainId: captain.id,
      deliveryFee: settlement.deliveryFee,
      commissionPercent,
    };
  },

  /**
   * بعد `ORDER_DELIVERED_CAPTAIN_DEDUCTION` في الدفتر: يعكس نفس خصم العمولة في رصيد الباقة المدفوعة مسبقاً
   * عند `policy.prepaidEnabled` فقط. يجب استدعاؤه داخل نفس `tx` بعد تثبيت سطر الدفتر.
   */
  async mirrorDeliveredPrepaidDeductionAfterLedgerTx(
    tx: Tx,
    input: {
      order: { id: string; orderNumber: string };
      comm: {
        captainBalanceDeduction: Prisma.Decimal;
        captainId: string;
        deliveryFee: Prisma.Decimal;
        commissionPercent: Prisma.Decimal;
        platformCommission: Prisma.Decimal;
        captainNetShare: Prisma.Decimal;
        companyProfit: Prisma.Decimal;
      };
      actorUserId: string | null;
    },
  ): Promise<void> {
    if (!ORDER_DELIVERED_LEDGER_HOOK_ENABLED) return;

    const { captain, policy } = await loadCaptainPolicyTx(tx, input.comm.captainId);
    if (!policy.prepaidEnabled) return;

    const deduction = money(input.comm.captainBalanceDeduction);
    if (deduction.lte(ZERO)) return;

    const existing = await tx.captainBalanceTransaction.findFirst({
      where: {
        captainId: input.comm.captainId,
        orderId: input.order.id,
        type: CaptainBalanceTransactionType.DEDUCTION,
      },
      select: { id: true },
    });
    if (existing) return;

    const deliveryFee = money(input.comm.deliveryFee);
    const nextBalance = money(captain.prepaidBalance.minus(deduction));

    await tx.captain.update({
      where: { id: captain.id },
      data: {
        prepaidBalance: nextBalance,
        totalDeducted: { increment: deduction },
        lastBalanceUpdatedAt: new Date(),
      },
    });

    await tx.captainBalanceTransaction.create({
      data: {
        captainId: captain.id,
        type: CaptainBalanceTransactionType.DEDUCTION,
        amount: deduction,
        balanceAfter: nextBalance,
        commissionPercentSnapshot: policy.commissionPercent,
        deliveryFeeSnapshot: deliveryFee,
        orderId: input.order.id,
        note: `خصم التوصيل بعد تسليم الطلب ${input.order.orderNumber} (عمولة منصّة ${money(input.comm.platformCommission).toFixed(2)}، ربح شركة ${money(input.comm.companyProfit).toFixed(2)}، صافي كابتن ${money(input.comm.captainNetShare).toFixed(2)})`,
        createdBy: input.actorUserId,
      },
    });

    await activityService.logTx(tx, input.actorUserId, "CAPTAIN_PREPAID_DEDUCTED", "captain", captain.id, {
      orderId: input.order.id,
      orderNumber: input.order.orderNumber,
      deliveryFee: deliveryFee.toFixed(2),
      commissionPercent: policy.commissionPercent.toFixed(2),
      platformCommission: money(input.comm.platformCommission).toFixed(2),
      companyProfit: money(input.comm.companyProfit).toFixed(2),
      captainNetShare: money(input.comm.captainNetShare).toFixed(2),
      captainBalanceDeduction: deduction.toFixed(2),
      balanceAfter: nextBalance.toFixed(2),
    });
  },

  async deductForDeliveredOrderTx(tx: Tx, orderId: string, actorUserId: string | null) {
    if (ORDER_DELIVERED_LEDGER_HOOK_ENABLED) {
      return { skipped: true as const, reason: "LEDGER_DELIVERED_HOOK_ACTIVE" as const };
    }
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        amount: true,
        deliveryFee: true,
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
    const settings = await getSettingsTx(tx);
    if (!policy.prepaidEnabled) return { skipped: true as const, reason: "PREPAID_DISABLED" as const };

    const deliveryFee = resolveDeliveryFeeForCommission(order);
    const commissionPercent = resolveEffectivePlatformCommissionPercent({
      prepaidAllowCaptainCustomCommission: settings.prepaidAllowCaptainCustomCommission,
      prepaidDefaultCommissionPercent: settings.prepaidDefaultCommissionPercent,
      captainCommissionPercentOverride: captain.commissionPercent,
    });
    const settlement = resolveDeliverySettlementFromDeliveryFee({
      deliveryFee,
      platformCommissionPercent: commissionPercent,
      captainFixedSharePerDelivery: settings.captainFixedSharePerDelivery,
    });
    const deduction = settlement.captainBalanceDeduction;
    if (deduction.lte(0)) return { skipped: true as const, reason: "ZERO_CAPTAIN_DEDUCTION" as const };

    const nextBalance = money(captain.prepaidBalance.minus(deduction));
    await tx.captain.update({
      where: { id: captain.id },
      data: {
        prepaidBalance: nextBalance,
        totalDeducted: { increment: deduction },
        lastBalanceUpdatedAt: new Date(),
      },
    });

    const transaction = await tx.captainBalanceTransaction.create({
      data: {
        captainId: captain.id,
        type: CaptainBalanceTransactionType.DEDUCTION,
        amount: deduction,
        balanceAfter: nextBalance,
        commissionPercentSnapshot: policy.commissionPercent,
        deliveryFeeSnapshot: deliveryFee,
        orderId,
        note: `خصم التوصيل بعد تسليم الطلب ${order.orderNumber}`,
        createdBy: actorUserId,
      },
    });

    await activityService.logTx(tx, actorUserId, "CAPTAIN_PREPAID_DEDUCTED", "captain", captain.id, {
      orderId,
      orderNumber: order.orderNumber,
      deliveryFee: deliveryFee.toFixed(2),
      commissionPercent: policy.commissionPercent.toFixed(2),
      captainBalanceDeduction: deduction.toFixed(2),
      balanceAfter: nextBalance.toFixed(2),
    });

    return transaction;
  },

  async chargeCaptain(captainId: string, input: { amount: number; note?: string }, actorUserId: string) {
    const amount = money(input.amount);
    if (amount.lte(0)) throw new AppError(400, "Amount must be greater than zero", "BAD_REQUEST");

    return prisma.$transaction(
      async (tx) => {
        const { captain, policy } = await loadCaptainPolicyTx(tx, captainId);
        const opId = randomUUID();
        const wallet = await ensureWalletAccountInTx(tx, {
          ownerType: WalletOwnerType.CAPTAIN,
          ownerId: captainId,
          companyId: captain.companyId,
        });
        await appendLedgerEntryInTx(tx, {
          walletAccountId: wallet.id,
          entryType: LedgerEntryType.CAPTAIN_PREPAID_CHARGE,
          amount,
          idempotencyKey: prepaidChargeLedgerIdempotencyKey(opId),
          createdByUserId: actorUserId,
          referenceType: LEDGER_REF_CAPTAIN_PREPAID_OP,
          referenceId: opId,
          metadata: { captainId, leg: "prepaid_charge" },
        });

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
            prepaidLedgerOperationId: opId,
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
          actorUserId,
          targetCaptainId: captainId,
          companyId: captain.companyId,
          amount: amount.toFixed(2),
          reason: input.note ?? "CAPTAIN_PREPAID_CHARGE",
          balanceAfter: nextBalance.toFixed(2),
          note: input.note ?? null,
        });
        return transaction;
      },
      { ...CAPTAIN_PREPAID_LEDGER_MUTATION_TX_OPTIONS },
    );
  },

  /**
   * Hardened prepaid charge: client `idempotencyKey` + `reason`, namespaced ledger key (no double-credit).
   * Use `POST /api/v1/finance/captains/:captainId/prepaid-charge` (COMPANY_ADMIN or SUPER_ADMIN).
   * Company Admin: `captain.companyId` must match `actor.companyId` (steward/createdBy rules are not used here).
   * Legacy `chargeCaptain` (random op id) is unchanged.
   */
  async chargeCaptainWithClientIdempotency(input: {
    actor: { userId: string; role: AppRole; companyId: string | null; branchId: string | null };
    captainId: string;
    amount: Prisma.Decimal | string | number;
    reason: string;
    idempotencyKey: string;
  }): Promise<{
    idempotent: boolean;
    transaction: CaptainBalanceTransaction;
    ledgerEntryId: string;
    balanceAfter: string;
    prepaidBalance: string;
  }> {
    const { actor, captainId } = input;
    const reason = input.reason.trim();
    if (!reason) {
      throw new AppError(400, "Reason is required", "REASON_REQUIRED");
    }
    const clientIdem = input.idempotencyKey.trim();
    if (!clientIdem) {
      throw new AppError(400, "idempotencyKey is required", "LEDGER_IDEMPOTENCY_KEY_REQUIRED");
    }
    const amount = money(input.amount);
    if (amount.lte(0)) {
      throw new AppError(400, "Amount must be greater than zero", "BAD_REQUEST");
    }

    let flow: "company_admin" | "super_admin";
    if (isSuperAdminRole(actor.role)) {
      flow = "super_admin";
    } else if (isCompanyAdminRole(actor.role)) {
      if (!actor.companyId) {
        throw new AppError(403, "Company scope is required on your account for this operation.", "TENANT_SCOPE_REQUIRED");
      }
      flow = "company_admin";
    } else {
      throw new AppError(403, "Forbidden", "FORBIDDEN");
    }

    const ledgerIdempotencyKey = financePrepaidChargeClientIdempotencyKey(flow, captainId, clientIdem);
    const operationRefId = ledgerIdempotencyKey;
    const sourceMeta =
      flow === "company_admin" ? "company_admin_captain_prepaid_charge" : "super_admin_captain_prepaid_charge";

    const coDebitsKey =
      flow === "company_admin" && actor.companyId
        ? buildCompanyAdminCaptainCoDebitIdempotencyKey(actor.companyId, captainId, clientIdem)
        : null;

    return prisma.$transaction(
      async (tx) => {
        const { captain, policy } = await loadCaptainPolicyTx(tx, captainId);
        if (isCompanyAdminRole(actor.role)) {
          if (captain.companyId !== actor.companyId) {
            throw new AppError(403, "Forbidden", "FORBIDDEN");
          }
        }

        const wallet = await ensureWalletAccountInTx(tx, {
          ownerType: WalletOwnerType.CAPTAIN,
          ownerId: captainId,
          companyId: captain.companyId,
        });

        if (coDebitsKey) {
          const exCo = await tx.ledgerEntry.findUnique({ where: { idempotencyKey: coDebitsKey } });
          const exCap = await tx.ledgerEntry.findUnique({ where: { idempotencyKey: ledgerIdempotencyKey } });
          if (exCo && exCap) {
            const existing = await tx.captainBalanceTransaction.findFirst({
              where: { prepaidLedgerOperationId: exCap.referenceId },
            });
            if (!existing) {
              throw new AppError(500, "Inconsistent ledger without matching balance transaction", "INTERNAL");
            }
            const cap = await tx.captain.findUniqueOrThrow({ where: { id: captainId } });
            return {
              idempotent: true,
              transaction: existing,
              ledgerEntryId: exCap.id,
              balanceAfter: decString(cap.prepaidBalance),
              prepaidBalance: decString(cap.prepaidBalance),
            };
          }
          if (Boolean(exCo) !== Boolean(exCap)) {
            throw new AppError(500, "Inconsistent company/captain ledger legs for prepaid top-up", "WALLET_CO_CAPTAIN_INCOMPLETE");
          }
          if (!exCo) {
            const companyWallet = await getOrCreateCompanyWallet(actor.companyId!, tx);
            if (money(companyWallet.balanceCached).lt(amount)) {
              throw new AppError(409, "Insufficient company wallet balance for this top-up", "INSUFFICIENT_COMPANY_BALANCE");
            }
            await appendLedgerEntryInTx(tx, {
              walletAccountId: companyWallet.id,
              entryType: LedgerEntryType.WALLET_TRANSFER,
              amount: amount.negated(),
              idempotencyKey: coDebitsKey,
              createdByUserId: actor.userId,
              counterpartyAccountId: wallet.id,
              referenceType: "CAPTAIN",
              referenceId: captainId,
              metadata: {
                source: "company_admin_captain_topup_company_debit",
                captainId,
                reason,
                operationGroup: operationRefId,
                actorUserId: actor.userId,
              },
            });
          }
        }

        const r = await appendLedgerEntryInTx(tx, {
          walletAccountId: wallet.id,
          entryType: LedgerEntryType.CAPTAIN_PREPAID_CHARGE,
          amount,
          idempotencyKey: ledgerIdempotencyKey,
          createdByUserId: actor.userId,
          referenceType: LEDGER_REF_CAPTAIN_PREPAID_OP,
          referenceId: operationRefId,
          metadata: {
            captainId,
            leg: "prepaid_charge",
            source: sourceMeta,
            reason,
            actorUserId: actor.userId,
          },
        });

        if (r.idempotent) {
          if (coDebitsKey) {
            const co = await tx.ledgerEntry.findUnique({ where: { idempotencyKey: coDebitsKey } });
            if (!co) {
              throw new AppError(500, "Captain leg idempotent without company wallet debit", "WALLET_CO_CAPTAIN_INCOMPLETE");
            }
          }
          const existing = await tx.captainBalanceTransaction.findFirst({
            where: { prepaidLedgerOperationId: r.entry.referenceId },
          });
          if (!existing) {
            throw new AppError(500, "Inconsistent ledger without matching balance transaction", "INTERNAL");
          }
          const cap = await tx.captain.findUniqueOrThrow({ where: { id: captainId } });
          return {
            idempotent: true,
            transaction: existing,
            ledgerEntryId: r.entry.id,
            balanceAfter: decString(cap.prepaidBalance),
            prepaidBalance: decString(cap.prepaidBalance),
          };
        }

        const nextBalance = money(captain.prepaidBalance.plus(amount));
        const transaction = await tx.captainBalanceTransaction.create({
          data: {
            captainId,
            type: CaptainBalanceTransactionType.CHARGE,
            amount,
            balanceAfter: nextBalance,
            commissionPercentSnapshot: policy.commissionPercent,
            note: reason,
            createdBy: actor.userId,
            prepaidLedgerOperationId: operationRefId,
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
        await activityService.logTx(tx, actor.userId, "CAPTAIN_PREPAID_CHARGED", "captain", captainId, {
          actorUserId: actor.userId,
          targetCaptainId: captainId,
          companyId: captain.companyId,
          amount: amount.toFixed(2),
          reason,
          reasonSource: "finance_prepaid_api",
          balanceAfter: nextBalance.toFixed(2),
          idempotencyKey: clientIdem,
        });
        return {
          idempotent: false,
          transaction,
          ledgerEntryId: r.entry.id,
          balanceAfter: decString(nextBalance),
          prepaidBalance: decString(nextBalance),
        };
      },
      { ...CAPTAIN_PREPAID_LEDGER_MUTATION_TX_OPTIONS },
    );
  },

  async adjustCaptain(captainId: string, input: { amount: number; note: string }, actorUserId: string) {
    const amount = money(input.amount);
    if (amount.eq(0)) throw new AppError(400, "Adjustment amount cannot be zero", "BAD_REQUEST");
    if (!input.note.trim()) throw new AppError(400, "Adjustment note is required", "BAD_REQUEST");

    return prisma.$transaction(
      async (tx) => {
        const { captain, policy } = await loadCaptainPolicyTx(tx, captainId);
        const opId = randomUUID();
        const wallet = await ensureWalletAccountInTx(tx, {
          ownerType: WalletOwnerType.CAPTAIN,
          ownerId: captainId,
          companyId: captain.companyId,
        });
        await appendLedgerEntryInTx(tx, {
          walletAccountId: wallet.id,
          entryType: LedgerEntryType.CAPTAIN_PREPAID_ADJUSTMENT,
          amount,
          idempotencyKey: prepaidAdjustLedgerIdempotencyKey(opId),
          createdByUserId: actorUserId,
          referenceType: LEDGER_REF_CAPTAIN_PREPAID_OP,
          referenceId: opId,
          metadata: { captainId, leg: "prepaid_adjust" },
        });

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
            prepaidLedgerOperationId: opId,
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
          actorUserId,
          targetCaptainId: captainId,
          companyId: captain.companyId,
          amount: amount.toFixed(2),
          reason: input.note,
          balanceAfter: nextBalance.toFixed(2),
          note: input.note,
        });
        return transaction;
      },
      { ...CAPTAIN_PREPAID_LEDGER_MUTATION_TX_OPTIONS },
    );
  },

  async getSummary(captainId: string) {
    return prisma.$transaction(async (tx) => {
      const { captain, policy } = await loadCaptainPolicyTx(tx, captainId);
      const [lastCharge, lastDeduction, deliveredFeeAvgRows, wallet] = await Promise.all([
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
        tx.$queryRaw<Array<{ avg: Prisma.Decimal | null }>>(
          Prisma.sql`
            SELECT AVG(
              COALESCE(o.delivery_fee, GREATEST(0::numeric, o.cash_collection - o.amount))
            ) AS avg
            FROM orders o
            WHERE o.assigned_captain_id = ${captainId}
              AND o.status::text = 'DELIVERED'
          `,
        ),
        tx.walletAccount.findUnique({
          where: { ownerType_ownerId: { ownerType: WalletOwnerType.CAPTAIN, ownerId: captainId } },
          select: { balanceCached: true },
        }),
      ]);
      const settings = await getSettingsTx(tx);
      const averageDeliveryFee = money(deliveredFeeAvgRows[0]?.avg ?? 0);
      const captainFixed = money(settings.captainFixedSharePerDelivery);
      const estimatedDeductionPerOrder = money(averageDeliveryFee.minus(captainFixed));
      const estimatedUnit = estimatedDeductionPerOrder.gt(0) ? estimatedDeductionPerOrder : ZERO;
      const estimatedRemainingOrders = estimatedUnit.gt(0)
        ? Math.max(0, Math.floor(policy.currentBalance.div(estimatedUnit).toNumber()))
        : null;

      const readAlignment = buildCaptainReadAlignment({
        captainPrepaid: captain.prepaidBalance,
        walletBalanceCached: wallet?.balanceCached ?? null,
      });

      return {
        ...summaryDto({
          captain,
          policy,
          lastChargeAt: lastCharge?.createdAt ?? null,
          lastDeductionAt: lastDeduction?.createdAt ?? null,
          estimatedRemainingOrders,
        }),
        readAlignment,
      };
    });
  },

  async listTransactions(
    captainId: string,
    params: { page: number; pageSize: number; from?: string; to?: string },
  ) {
    const page = Math.max(1, params.page);
    const pageSize = Math.min(100, Math.max(1, params.pageSize));
    const hasRange = Boolean(params.from && params.to);
    let createdAt: { gte: Date; lte: Date } | undefined;
    if (hasRange) {
      const fromMs = Date.parse(params.from!);
      const toMs = Date.parse(params.to!);
      if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
        throw new AppError(400, "from and to must be valid ISO-8601 datetimes", "INVALID_RANGE");
      }
      if (fromMs > toMs) throw new AppError(400, "from must be on or before to", "INVALID_RANGE");
      if (toMs - fromMs > 90 * 24 * 60 * 60 * 1000) {
        throw new AppError(400, "Date range may not exceed 90 days", "REPORT_RANGE_TOO_LARGE");
      }
      createdAt = { gte: new Date(fromMs), lte: new Date(toMs) };
    }
    const where: Prisma.CaptainBalanceTransactionWhereInput = {
      captainId,
      ...(createdAt ? { createdAt } : {}),
    };
    const [total, items] = await prisma.$transaction([
      prisma.captainBalanceTransaction.count({ where }),
      prisma.captainBalanceTransaction.findMany({
        where,
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
