/**
 * Exercises the delivered-only ledger hook (Slice 5). Run from `apps/api`: `npm run verify:order-delivered-ledger`
 * Leaves a delivered test order in the DB on success; remove manually if needed.
 */
import "dotenv/config";
import { CaptainBalanceTransactionType, OrderStatus, Prisma, WalletOwnerType } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";
import { applyDeliveredOrderLedgerTx } from "../src/services/order-delivered-ledger.service.js";
import { money } from "../src/services/ledger/index.js";
import { generateOrderNumber } from "../src/utils/order-number.js";

async function main() {
  const branch = await prisma.branch.findFirst({ where: { isActive: true } });
  if (!branch) throw new Error("No branch");
  const store = await prisma.store.findFirst({ where: { companyId: branch.companyId } });
  if (!store) throw new Error("No store");
  const captain = await prisma.captain.findFirst({ where: { companyId: branch.companyId } });
  if (!captain) throw new Error("No captain");

  await prisma.dashboardSettings.upsert({
    where: { id: "default" },
    create: { id: "default", prepaidCaptainsEnabled: true },
    update: { prepaidCaptainsEnabled: true },
  });
  await prisma.captain.update({
    where: { id: captain.id },
    data: { prepaidEnabled: true, prepaidBalance: new Prisma.Decimal("1000.00") },
  });

  const order = await prisma.order.create({
    data: {
      orderNumber: generateOrderNumber(),
      customerName: "Ledge verify",
      customerPhone: "+966500000099",
      companyId: branch.companyId,
      branchId: branch.id,
      storeId: store.id,
      pickupAddress: "P",
      dropoffAddress: "D",
      area: "Riyadh",
      amount: new Prisma.Decimal("40.00"),
      cashCollection: new Prisma.Decimal("47.50"),
      deliveryFee: new Prisma.Decimal("7.50"),
      status: OrderStatus.PENDING,
      assignedCaptainId: captain.id,
    },
  });

  await prisma.$transaction(
    async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.DELIVERED },
      });
      await applyDeliveredOrderLedgerTx(tx, order.id, null);
    },
    { maxWait: 10_000, timeout: 60_000 },
  );

  const sLine = await prisma.ledgerEntry.findFirst({
    where: { idempotencyKey: `delivered:order:${order.id}:store_debit` },
  });
  const cLine = await prisma.ledgerEntry.findFirst({
    where: { idempotencyKey: `delivered:order:${order.id}:captain_deduction` },
  });
  if (!sLine || !cLine) {
    throw new Error("Expected both ledger lines");
  }
  if (!money(sLine.amount).equals(money("-7.50"))) {
    throw new Error("Store line amount should be -7.50");
  }

  const storeWallet = await prisma.walletAccount.findUnique({
    where: { ownerType_ownerId: { ownerType: WalletOwnerType.STORE, ownerId: store.id } },
  });
  const capWallet = await prisma.walletAccount.findUnique({
    where: { ownerType_ownerId: { ownerType: WalletOwnerType.CAPTAIN, ownerId: captain.id } },
  });
  if (!storeWallet || !capWallet) {
    throw new Error("Expected store and captain wallets after hook");
  }
  const storeBal1 = money(storeWallet.balanceCached);
  const capBal1 = money(capWallet.balanceCached);

  await prisma.$transaction(
    async (tx) => {
      await applyDeliveredOrderLedgerTx(tx, order.id, null);
    },
    { maxWait: 10_000, timeout: 60_000 },
  );
  const storeWallet2 = await prisma.walletAccount.findUniqueOrThrow({ where: { id: storeWallet.id } });
  const capWallet2 = await prisma.walletAccount.findUniqueOrThrow({ where: { id: capWallet.id } });
  if (!money(storeWallet2.balanceCached).equals(storeBal1) || !money(capWallet2.balanceCached).equals(capBal1)) {
    throw new Error("Idempotent replay should not change balances");
  }

  const expectedPrepaid = money(cLine.amount).abs();
  const tp = await prisma.captainBalanceTransaction.findFirst({
    where: { orderId: order.id, type: CaptainBalanceTransactionType.DEDUCTION, captainId: captain.id },
  });
  if (!tp) {
    throw new Error("Expected prepaid DEDUCTION mirror when product prepaid is enabled and commission > 0");
  }
  if (!money(tp.amount).equals(expectedPrepaid)) {
    throw new Error("Prepaid mirror amount must match abs(ledger captain line)");
  }

  // eslint-disable-next-line no-console
  console.info("[verify-order-delivered-ledger] passed (orderId=%s)", order.id);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
