/**
 * Read-path alignment: `getSummary` includes `readAlignment` with display rule + parity.
 * Run from `apps/api`: `npm run verify:captain-read-alignment`
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";
import { captainPrepaidBalanceService } from "../src/services/captain-prepaid-balance.service.js";

async function main() {
  const captain = await prisma.captain.findFirst();
  if (!captain) throw new Error("Need a captain");

  const s = await captainPrepaidBalanceService.getSummary(captain.id);
  const ra = s.readAlignment;
  if (!ra) {
    throw new Error("readAlignment is required on CaptainPrepaidSummary");
  }
  if (ra.prepaidBalance !== s.prepaidBalance) {
    throw new Error("readAlignment.prepaidBalance should match summary prepaidBalance");
  }
  if (ra.parity === "NO_WALLET") {
    if (ra.walletBalance != null) throw new Error("NO_WALLET implies walletBalance null");
    if (ra.displayBalance !== ra.prepaidBalance) throw new Error("display should equal prepaid when no wallet");
  } else {
    if (ra.walletBalance == null) throw new Error("parity OK|MISMATCH should set walletBalance");
    if (ra.displayBalance !== ra.walletBalance) throw new Error("display should be wallet when wallet exists");
  }

  // eslint-disable-next-line no-console
  console.log("[verify-captain-read-alignment] passed", { parity: ra.parity });
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
