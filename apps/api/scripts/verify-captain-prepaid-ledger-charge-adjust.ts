/**
 * Service checks: CHARGE/ADJUSTMENT create paired ledger + cbt. Run: `npm run verify:captain-prepaid-ledger-charge-adjust`
 * from `apps/api`. Requires DB; leaves balance movements on a captain.
 */
import "dotenv/config";
import {
  CaptainBalanceTransactionType,
  LedgerEntryType,
  Prisma,
  WalletOwnerType,
} from "@prisma/client";
import { LEDGER_REF_CAPTAIN_PREPAID_OP } from "../src/config/captain-prepaid-ledger.js";
import { prisma } from "../src/lib/prisma.js";
import { captainPrepaidBalanceService } from "../src/services/captain-prepaid-balance.service.js";
import { money } from "../src/services/ledger/money.js";

async function expectLedgerPair(
  opId: string,
  type: "charge" | "adjust",
  cbtId: string,
  cbtAmount: Prisma.Decimal,
) {
  const want = type === "charge" ? LedgerEntryType.CAPTAIN_PREPAID_CHARGE : LedgerEntryType.CAPTAIN_PREPAID_ADJUSTMENT;
  const le = await prisma.ledgerEntry.findFirstOrThrow({
    where: { entryType: want, referenceType: LEDGER_REF_CAPTAIN_PREPAID_OP, referenceId: opId },
  });
  if (!money(le.amount).equals(money(cbtAmount))) {
    throw new Error("ledger amount should match cbt");
  }
  const c = await prisma.captainBalanceTransaction.findUniqueOrThrow({ where: { id: cbtId } });
  if (c.prepaidLedgerOperationId !== opId) {
    throw new Error("cbt.prepaidLedgerOperationId should match op id");
  }
  const w = await prisma.walletAccount.findUniqueOrThrow({
    where: { ownerType_ownerId: { ownerType: WalletOwnerType.CAPTAIN, ownerId: c.captainId } },
  });
  if (w.id !== le.walletAccountId) {
    throw new Error("ledger line should be on captain wallet");
  }
}

async function main() {
  const captain = await prisma.captain.findFirst();
  if (!captain) throw new Error("Need a captain");
  const staff = await prisma.user.findFirst({ where: { id: { not: captain.userId } } });
  if (!staff) throw new Error("Need a non-captain user for createdBy/activity");

  const ch = await captainPrepaidBalanceService.chargeCaptain(
    captain.id,
    { amount: 20.5, note: "verify charge" },
    staff.id,
  );
  if (!ch.prepaidLedgerOperationId) throw new Error("CHARGE should set prepaidLedgerOperationId");
  await expectLedgerPair(ch.prepaidLedgerOperationId, "charge", ch.id, ch.amount);

  const ad = await captainPrepaidBalanceService.adjustCaptain(
    captain.id,
    { amount: -5, note: "verify adjust" },
    staff.id,
  );
  if (!ad.prepaidLedgerOperationId) throw new Error("ADJUST should set prepaidLedgerOperationId");
  await expectLedgerPair(ad.prepaidLedgerOperationId, "adjust", ad.id, ad.amount);

  // eslint-disable-next-line no-console
  console.log("[verify-captain-prepaid-ledger-charge-adjust] passed");
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
