/**
 * When `DISTRIBUTION_GATING_USE_ALIGNED_BALANCE` is on, `getSummary` policy.currentBalance must match
 * `readAlignment.displayBalance`. Run: `npm run verify:distribution-gating-alignment` from `apps/api`.
 */
import "dotenv/config";
import { captainPrepaidBalanceService } from "../src/services/captain-prepaid-balance.service.js";
import { DISTRIBUTION_GATING_USE_ALIGNED_BALANCE } from "../src/config/distribution-gating-flags.js";
import { prisma } from "../src/lib/prisma.js";

async function main() {
  if (!DISTRIBUTION_GATING_USE_ALIGNED_BALANCE) {
    // eslint-disable-next-line no-console
    console.log("[verify-distribution-gating-alignment] skip (flag off, prepaid-only policy)");
    return;
  }
  const captain = await prisma.captain.findFirst();
  if (!captain) throw new Error("Need a captain");
  const s = await captainPrepaidBalanceService.getSummary(captain.id);
  if (!s.readAlignment) throw new Error("readAlignment required");
  if (s.currentBalance !== s.readAlignment.displayBalance) {
    throw new Error(
      `Policy currentBalance (${s.currentBalance}) should match readAlignment.displayBalance (${s.readAlignment.displayBalance}) when aligned gating is on`,
    );
  }
  // eslint-disable-next-line no-console
  console.log("[verify-distribution-gating-alignment] passed");
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
