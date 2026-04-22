/**
 * Validates `computeCaptainOrderFinancialBreakdown` + change math assumptions (no UI).
 * Run from repo root: `npx tsx apps/captain-mobile/scripts/validate-financial-logic.ts`
 */
import { assertFinancialBreakdownSelfTest } from "../src/lib/order-financial-breakdown";

assertFinancialBreakdownSelfTest();
// eslint-disable-next-line no-console
console.info("[validate-financial-logic] passed");
