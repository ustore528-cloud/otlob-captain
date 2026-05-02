import { LedgerEntryType, OrderStatus, Prisma, WalletOwnerType } from "@prisma/client";
import { ORDER_DELIVERED_LEDGER_HOOK_ENABLED } from "../config/order-ledger-flags.js";
import { appendLedgerEntryInTx, money, ensureWalletAccountInTx } from "./ledger/index.js";
import { captainPrepaidBalanceService } from "./captain-prepaid-balance.service.js";

const idemStore = (orderId: string, walletId: string) =>
  `delivered:order:${orderId}:wallet:${walletId}:tx:store_debit` as const;
const idemCaptain = (orderId: string, walletId: string) =>
  `delivered:order:${orderId}:wallet:${walletId}:tx:captain_deduction` as const;

/**
 * Appends at most two ledger lines when an order is DELIVERED: store debit (optional) and captain commission deduction.
 * Must run inside the same `tx` as the order status update to `DELIVERED`.
 */
export async function applyDeliveredOrderLedgerTx(
  tx: Prisma.TransactionClient,
  orderId: string,
  actorUserId: string | null,
): Promise<void> {
  if (!ORDER_DELIVERED_LEDGER_HOOK_ENABLED) return;

  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      companyId: true,
      storeId: true,
      assignedCaptainId: true,
      amount: true,
      deliveryFee: true,
      cashCollection: true,
    },
  });
  if (!order || order.status !== OrderStatus.DELIVERED) return;

  if (order.deliveryFee != null) {
    const storeDebit = money(order.deliveryFee);
    if (storeDebit.gt(0)) {
      const storeWallet = await ensureWalletAccountInTx(tx, {
        ownerType: WalletOwnerType.STORE,
        ownerId: order.storeId,
        companyId: order.companyId,
      });
      const txType = "ORDER_DELIVERED_STORE_DEBIT";
      const idempotencyKey = idemStore(orderId, storeWallet.id);
      try {
        await appendLedgerEntryInTx(tx, {
          walletAccountId: storeWallet.id,
          entryType: LedgerEntryType.ORDER_DELIVERED_STORE_DEBIT,
          amount: storeDebit.negated(),
          idempotencyKey,
          orderId: order.id,
          createdByUserId: actorUserId,
          referenceType: "ORDER",
          referenceId: order.id,
          metadata: { orderNumber: order.orderNumber, leg: "store_debit" },
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("[order-delivered-ledger] append failed", {
          orderId: order.id,
          captainId: order.assignedCaptainId ?? null,
          walletId: storeWallet.id,
          transactionType: txType,
          idempotencyKey,
          error,
        });
        throw error;
      }
    }
  }

  if (!order.assignedCaptainId) return;

  const fin = await captainPrepaidBalanceService.resolveDeliveredCommissionForLedgerTx(tx, {
    assignedCaptainId: order.assignedCaptainId,
    amount: order.amount,
    deliveryFee: order.deliveryFee,
    cashCollection: order.cashCollection,
  });
  if (!fin) return;

  const captainWallet = await ensureWalletAccountInTx(tx, {
    ownerType: WalletOwnerType.CAPTAIN,
    ownerId: fin.captainId,
    companyId: order.companyId,
  });

  const txType = "ORDER_DELIVERED_CAPTAIN_DEDUCTION";
  const idempotencyKey = idemCaptain(orderId, captainWallet.id);
  try {
    await appendLedgerEntryInTx(tx, {
      walletAccountId: captainWallet.id,
      entryType: LedgerEntryType.ORDER_DELIVERED_CAPTAIN_DEDUCTION,
      amount: fin.captainBalanceDeduction.negated(),
      idempotencyKey,
      orderId: order.id,
      createdByUserId: actorUserId,
      referenceType: "ORDER",
      referenceId: order.id,
      metadata: {
        orderNumber: order.orderNumber,
        leg: "captain_deduction",
        deliveryFee: fin.deliveryFee.toFixed(2),
        commissionPercent: fin.commissionPercent.toFixed(2),
        platformCommission: fin.platformCommission.toFixed(2),
        companyProfit: fin.companyProfit.toFixed(2),
        captainNetShare: fin.captainNetShare.toFixed(2),
        captainBalanceDeduction: fin.captainBalanceDeduction.toFixed(2),
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[order-delivered-ledger] append failed", {
      orderId: order.id,
      captainId: fin.captainId,
      walletId: captainWallet.id,
      transactionType: txType,
      idempotencyKey,
      error,
    });
    throw error;
  }

  await captainPrepaidBalanceService.mirrorDeliveredPrepaidDeductionAfterLedgerTx(tx, {
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
    },
    comm: {
      captainBalanceDeduction: fin.captainBalanceDeduction,
      captainId: fin.captainId,
      deliveryFee: fin.deliveryFee,
      commissionPercent: fin.commissionPercent,
      platformCommission: fin.platformCommission,
      captainNetShare: fin.captainNetShare,
      companyProfit: fin.companyProfit,
    },
    actorUserId,
  });
}
