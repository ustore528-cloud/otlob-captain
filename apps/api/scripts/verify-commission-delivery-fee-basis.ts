/**
 * Verifies commission base uses delivery fee (not customer collection total).
 * Run from `apps/api`: `npm run verify:commission-delivery-fee-basis`
 *
 * Example: amount=100, delivery_fee=20, cash_collection=120, 10% → commission 2.00 (not 12).
 */
import { Prisma } from "@prisma/client";
import { resolveDeliveryFeeForCommission } from "../src/domain/order-delivery-fee-for-commission.js";
import { captainPrepaidBalanceService } from "../src/services/captain-prepaid-balance.service.js";

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

function main(): void {
  const canonical = resolveDeliveryFeeForCommission({
    amount: new Prisma.Decimal("100"),
    deliveryFee: new Prisma.Decimal("20"),
    cashCollection: new Prisma.Decimal("120"),
  });
  assert(canonical.toFixed(2) === "20.00", `canonical delivery fee base expected 20.00, got ${canonical}`);

  const legacy = resolveDeliveryFeeForCommission({
    amount: new Prisma.Decimal("100"),
    deliveryFee: null,
    cashCollection: new Prisma.Decimal("120"),
  });
  assert(legacy.toFixed(2) === "20.00", `legacy derived fee expected 20.00, got ${legacy}`);

  const pct = new Prisma.Decimal("10");
  const commission = captainPrepaidBalanceService.calculateCommission(canonical, pct);
  assert(commission.toFixed(2) === "2.00", `10% of 20 expected 2.00 commission, got ${commission}`);

  const zeroFee = resolveDeliveryFeeForCommission({
    amount: new Prisma.Decimal("50"),
    deliveryFee: new Prisma.Decimal("0"),
    cashCollection: new Prisma.Decimal("50"),
  });
  assert(zeroFee.toFixed(2) === "0.00", `zero delivery fee expected 0, got ${zeroFee}`);

  // eslint-disable-next-line no-console
  console.info("[verify-commission-delivery-fee-basis] passed");
}

main();
