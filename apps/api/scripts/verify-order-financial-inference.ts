/**
 * Verifies shared `inferOrderFinancialBreakdown` matches API `toOrderDetailDto` financial snapshot
 * for representative scenarios (no DB).
 *
 * Run from `apps/api`: `npm run verify:order-financial-inference`
 */
import { inferOrderFinancialBreakdown } from "@captain/shared";
import { toOrderDetailDto } from "../src/dto/order.dto.js";
import { Prisma } from "@prisma/client";

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

const baseStore = { id: "s1", name: "Store", area: "Area" };

function makeOrder(amount: string, cash: string) {
  return {
    id: "o1",
    orderNumber: "ORD-1",
    assignedCaptainId: null,
    status: "PENDING" as const,
    customerName: "C",
    customerPhone: "+1",
    pickupAddress: "P",
    dropoffAddress: "D",
    area: "A",
    amount: new Prisma.Decimal(amount),
    cashCollection: new Prisma.Decimal(cash),
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    store: baseStore,
    assignmentLogs: [],
  };
}

function main() {
  const scenarios: { amount: string; cash: string }[] = [
    { amount: "100", cash: "120" },
    { amount: "50", cash: "0" },
    { amount: "120", cash: "120" },
    { amount: "99.99", cash: "100.50" },
  ];

  for (const s of scenarios) {
    const inferred = inferOrderFinancialBreakdown(s.amount, s.cash);
    const dto = toOrderDetailDto(makeOrder(s.amount, s.cash));
    assert(
      JSON.stringify(dto.financialBreakdown) === JSON.stringify(inferred),
      `Mismatch for amount=${s.amount} cash=${s.cash}\nAPI: ${JSON.stringify(dto.financialBreakdown)}\nShared: ${JSON.stringify(inferred)}`,
    );
  }
  // eslint-disable-next-line no-console
  console.info("[verify-order-financial-inference] passed:", scenarios.length, "scenarios");
}

main();
