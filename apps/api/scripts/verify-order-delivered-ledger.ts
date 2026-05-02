/**
 * Verifies delivered-order ledger + captain deduction split (delivery fee basis).
 * Run from `apps/api`: `npm run verify:order-delivered-ledger`
 *
 * Scenario: delivery ₪15, platform 15%, captain fixed net ₪10 → deduction ₪5, platform ₪2.25, company ₪2.75.
 * Leaves test rows in DB on success; remove manually if needed.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import {
  CaptainAvailabilityStatus,
  CaptainBalanceTransactionType,
  LedgerEntryType,
  OrderStatus,
  Prisma,
  UserRole,
  WalletOwnerType,
} from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";
import { applyDeliveredOrderLedgerTx } from "../src/services/order-delivered-ledger.service.js";
import { money } from "../src/services/ledger/index.js";
import { generateOrderNumber } from "../src/utils/order-number.js";
import { ORDER_STATUS_TX_OPTIONS } from "../src/config/order-ledger-flags.js";

async function ensureVerifyTenant(): Promise<{
  branch: { id: string; companyId: string };
  store: { id: string };
  captain: { id: string };
}> {
  const branch = await prisma.branch.findFirst({ where: { isActive: true } });
  const store =
    branch &&
    (await prisma.store.findFirst({ where: { companyId: branch.companyId, isActive: true } }));
  const captain =
    branch &&
    (await prisma.captain.findFirst({ where: { companyId: branch.companyId, isActive: true } }));

  if (branch && store && captain) {
    return { branch, store, captain };
  }

  const uid = randomUUID().replace(/-/g, "").slice(0, 10);
  const company = await prisma.company.create({ data: { name: `VerifyLedger-${uid}` } });
  const br = await prisma.branch.create({
    data: { name: `VL-${uid}`, companyId: company.id },
  });
  const storeOwner = await prisma.user.create({
    data: {
      fullName: "Verify store owner",
      phone: `+97250${uid.slice(0, 7)}`,
      passwordHash: "verify",
      role: UserRole.STORE_ADMIN,
      companyId: company.id,
      branchId: br.id,
    },
  });
  const st = await prisma.store.create({
    data: {
      name: `VL Store ${uid}`,
      phone: `+97251${uid.slice(0, 7)}`,
      area: "Test",
      address: "Verify",
      companyId: company.id,
      branchId: br.id,
      ownerUserId: storeOwner.id,
    },
  });
  const capUser = await prisma.user.create({
    data: {
      fullName: "Verify captain",
      phone: `+97252${uid.slice(0, 7)}`,
      passwordHash: "verify",
      role: UserRole.CAPTAIN,
      companyId: company.id,
      branchId: br.id,
    },
  });
  const cap = await prisma.captain.create({
    data: {
      userId: capUser.id,
      companyId: company.id,
      branchId: br.id,
      vehicleType: "bike",
      area: "Test",
      isActive: true,
      availabilityStatus: CaptainAvailabilityStatus.AVAILABLE,
    },
  });

  return { branch: br, store: st, captain: cap };
}

async function main() {
  const { branch, store, captain } = await ensureVerifyTenant();

  await prisma.dashboardSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      prepaidCaptainsEnabled: true,
      prepaidDefaultCommissionPercent: new Prisma.Decimal("15.00"),
      captainFixedSharePerDelivery: new Prisma.Decimal("10.00"),
    },
    update: {
      prepaidCaptainsEnabled: true,
      prepaidDefaultCommissionPercent: new Prisma.Decimal("15.00"),
      captainFixedSharePerDelivery: new Prisma.Decimal("10.00"),
    },
  });

  const initialPrepaid = new Prisma.Decimal("100.00");
  await prisma.captain.update({
    where: { id: captain.id },
    data: { prepaidEnabled: true, prepaidBalance: initialPrepaid },
  });

  await prisma.walletAccount.upsert({
    where: { ownerType_ownerId: { ownerType: WalletOwnerType.CAPTAIN, ownerId: captain.id } },
    create: {
      ownerType: WalletOwnerType.CAPTAIN,
      ownerId: captain.id,
      companyId: branch.companyId,
      currency: "ILS",
      balanceCached: initialPrepaid,
    },
    update: { balanceCached: initialPrepaid, currency: "ILS" },
  });

  const order = await prisma.order.create({
    data: {
      orderNumber: generateOrderNumber(),
      customerName: "Ledger verify",
      customerPhone: "+966500000099",
      companyId: branch.companyId,
      branchId: branch.id,
      storeId: store.id,
      pickupAddress: "P",
      dropoffAddress: "D",
      area: "Riyadh",
      /** Large store amount to confirm settlement ignores order amount (fee-only basis). */
      amount: new Prisma.Decimal("999.99"),
      cashCollection: new Prisma.Decimal("1014.99"),
      deliveryFee: new Prisma.Decimal("15.00"),
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
    ORDER_STATUS_TX_OPTIONS,
  );

  const sLine = await prisma.ledgerEntry.findFirst({
    where: { orderId: order.id, entryType: LedgerEntryType.ORDER_DELIVERED_STORE_DEBIT },
  });
  const cLine = await prisma.ledgerEntry.findFirst({
    where: { orderId: order.id, entryType: LedgerEntryType.ORDER_DELIVERED_CAPTAIN_DEDUCTION },
  });
  if (!sLine || !cLine) {
    throw new Error("Expected store debit + captain deduction ledger lines");
  }
  if (!money(sLine.amount).equals(money("-15.00"))) {
    throw new Error(`Store line amount expected -15.00, got ${sLine.amount}`);
  }
  if (!money(cLine.amount).equals(money("-5.00"))) {
    throw new Error(`Captain line amount expected -5.00 (delivery − captain net), got ${cLine.amount}`);
  }

  const meta = cLine.metadata as Record<string, unknown> | null;
  if (!meta || typeof meta !== "object") throw new Error("Expected captain ledger metadata object");
  const need = ["platformCommission", "companyProfit", "captainNetShare", "captainBalanceDeduction"] as const;
  for (const k of need) {
    if (typeof meta[k] !== "string") throw new Error(`Missing metadata ${k}`);
  }
  if (meta.platformCommission !== "2.25" || meta.companyProfit !== "2.75" || meta.captainNetShare !== "10.00") {
    throw new Error(`Unexpected metadata breakdown: ${JSON.stringify(meta)}`);
  }
  if (meta.captainBalanceDeduction !== "5.00") {
    throw new Error(`captainBalanceDeduction expected 5.00, got ${String(meta.captainBalanceDeduction)}`);
  }

  const storeWallet = await prisma.walletAccount.findUnique({
    where: { ownerType_ownerId: { ownerType: WalletOwnerType.STORE, ownerId: store.id } },
  });
  const capWalletRow = await prisma.walletAccount.findUnique({
    where: { ownerType_ownerId: { ownerType: WalletOwnerType.CAPTAIN, ownerId: captain.id } },
  });
  if (!storeWallet || !capWalletRow) {
    throw new Error("Expected store and captain wallets after hook");
  }
  const storeBal1 = money(storeWallet.balanceCached);
  const capBal1 = money(capWalletRow.balanceCached);

  if (!capBal1.equals(money("95.00"))) {
    throw new Error(`Captain wallet expected 95.00 after deduction, got ${capBal1.toFixed(2)}`);
  }

  const captainRow = await prisma.captain.findUniqueOrThrow({ where: { id: captain.id } });
  if (!money(captainRow.prepaidBalance).equals(money("95.00"))) {
    throw new Error(`Captain prepaid expected 95.00, got ${captainRow.prepaidBalance.toFixed(2)}`);
  }

  await prisma.$transaction(
    async (tx) => {
      await applyDeliveredOrderLedgerTx(tx, order.id, null);
    },
    ORDER_STATUS_TX_OPTIONS,
  );
  const storeWallet2 = await prisma.walletAccount.findUniqueOrThrow({ where: { id: storeWallet.id } });
  const capWallet2 = await prisma.walletAccount.findUniqueOrThrow({ where: { id: capWalletRow.id } });
  if (!money(storeWallet2.balanceCached).equals(storeBal1) || !money(capWallet2.balanceCached).equals(capBal1)) {
    throw new Error("Idempotent replay should not change balances");
  }

  const tp = await prisma.captainBalanceTransaction.findFirst({
    where: { orderId: order.id, type: CaptainBalanceTransactionType.DEDUCTION, captainId: captain.id },
  });
  if (!tp) {
    throw new Error("Expected prepaid DEDUCTION mirror when prepaid is enabled");
  }
  if (!money(tp.amount).equals(money("5.00"))) {
    throw new Error(`Prepaid mirror amount expected 5.00, got ${tp.amount}`);
  }

  const cancelled = await prisma.order.create({
    data: {
      orderNumber: generateOrderNumber(),
      customerName: "Cancelled verify",
      customerPhone: "+966500000088",
      companyId: branch.companyId,
      branchId: branch.id,
      storeId: store.id,
      pickupAddress: "P",
      dropoffAddress: "D",
      area: "Riyadh",
      amount: new Prisma.Decimal("50.00"),
      cashCollection: new Prisma.Decimal("65.00"),
      deliveryFee: new Prisma.Decimal("15.00"),
      status: OrderStatus.CANCELLED,
      assignedCaptainId: captain.id,
    },
  });
  const cancelCaptainLines = await prisma.ledgerEntry.count({
    where: { orderId: cancelled.id, entryType: LedgerEntryType.ORDER_DELIVERED_CAPTAIN_DEDUCTION },
  });
  if (cancelCaptainLines !== 0) {
    throw new Error("Cancelled order must not create captain delivery deduction lines");
  }

  // eslint-disable-next-line no-console
  console.info(
    "[verify-order-delivered-ledger] PASS — captain prepaid %s → %s, wallet %s → %s, orderId=%s",
    initialPrepaid.toFixed(2),
    captainRow.prepaidBalance.toFixed(2),
    money(initialPrepaid).toFixed(2),
    capBal1.toFixed(2),
    order.id,
  );
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
