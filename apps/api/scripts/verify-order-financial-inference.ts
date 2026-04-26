/**
 * Verifies shared financial helpers match API `toOrderDetailDto` financial snapshot (no DB).
 *
 * Run from `apps/api`: `npm run verify:order-financial-inference`
 */
import {
  inferCanonicalOrderFinancialBreakdown,
  inferLegacyOrderFinancialBreakdown,
} from "@captain/shared";
import { toOrderDetailDto } from "../src/dto/order.dto.js";
import { Prisma } from "@prisma/client";

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

const baseStore = { id: "s1", name: "Store", area: "Area" };

function makeOrder(amount: string, cash: string, deliveryFee: string | null) {
  return {
    id: "o1",
    orderNumber: "ORD-1",
    assignedCaptainId: null,
    status: "PENDING" as const,
    distributionMode: "AUTO" as const,
    companyId: "c1",
    branchId: "b1",
    customerName: "C",
    customerPhone: "+1",
    pickupAddress: "P",
    dropoffAddress: "D",
    pickupLat: null,
    pickupLng: null,
    dropoffLat: null,
    dropoffLng: null,
    area: "A",
    amount: new Prisma.Decimal(amount),
    cashCollection: new Prisma.Decimal(cash),
    deliveryFee: deliveryFee != null ? new Prisma.Decimal(deliveryFee) : null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    store: {
      ...baseStore,
      subscriptionType: "PUBLIC" as const,
      supervisorUser: null,
      primaryRegion: null,
    },
    assignmentLogs: [],
  };
}

function main() {
  const scenarios: { amount: string; cash: string; deliveryFee: string | null }[] = [
    { amount: "100", cash: "120", deliveryFee: "20" },
    { amount: "100", cash: "120", deliveryFee: null },
    { amount: "50", cash: "0", deliveryFee: null },
    { amount: "120", cash: "120", deliveryFee: null },
    { amount: "99.99", cash: "100.50", deliveryFee: null },
    { amount: "40", cash: "40", deliveryFee: "0" },
  ];

  for (const s of scenarios) {
    const inferred =
      s.deliveryFee != null
        ? inferCanonicalOrderFinancialBreakdown(s.amount, s.deliveryFee, s.cash)
        : inferLegacyOrderFinancialBreakdown(s.amount, s.cash);
    const dto = toOrderDetailDto(makeOrder(s.amount, s.cash, s.deliveryFee));
    assert(
      JSON.stringify(dto.financialBreakdown) === JSON.stringify(inferred),
      `Mismatch for ${JSON.stringify(s)}\nAPI: ${JSON.stringify(dto.financialBreakdown)}\nShared: ${JSON.stringify(inferred)}`,
    );
  }
  // eslint-disable-next-line no-console
  console.info("[verify-order-financial-inference] passed:", scenarios.length, "scenarios");
}

main();
