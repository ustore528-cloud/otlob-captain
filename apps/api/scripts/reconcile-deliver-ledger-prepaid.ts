/**
 * Report alignment between `ORDER_DELIVERED_CAPTAIN_DEDUCTION` ledger lines and prepaid `DEDUCTION` rows
 * (mirror path when prepaid product is enabled). Read-only. Run: `npx tsx scripts/reconcile-deliver-ledger-prepaid.ts`
 * Optional env: `SINCE` = ISO date to filter `ledger_entries.createdAt >= SINCE` (e.g. 2024-01-01)
 */
import "dotenv/config";
import { CaptainBalanceTransactionType, LedgerEntryType, Prisma, WalletOwnerType } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";
import { money } from "../src/services/ledger/money.js";

async function main() {
  const since = process.env.SINCE;
  const whereLedger: Prisma.LedgerEntryWhereInput = {
    entryType: LedgerEntryType.ORDER_DELIVERED_CAPTAIN_DEDUCTION,
    orderId: { not: null },
    ...(since ? { createdAt: { gte: new Date(since) } } : {}),
  };

  const ledgerRows = await prisma.ledgerEntry.findMany({
    where: whereLedger,
    include: { walletAccount: true },
    orderBy: { createdAt: "asc" },
  });

  const missingMirror: Array<{ orderId: string; captainId: string; ledgerAmountAbs: string; reason: string }> = [];
  const amountMismatch: Array<{ orderId: string; captainId: string; ledgerAbs: string; prepaidAmount: string }> = [];

  for (const le of ledgerRows) {
    if (le.walletAccount.ownerType !== WalletOwnerType.CAPTAIN) {
      // eslint-disable-next-line no-console
      console.warn("[reconcile] skip non-captain wallet on captain deduction line", le.id);
      continue;
    }
    const orderId = le.orderId;
    if (!orderId) continue;
    const captainId = le.walletAccount.ownerId;
    const ledgerAbs = money(le.amount).abs();

    const prepaid = await prisma.captainBalanceTransaction.findFirst({
      where: { captainId, orderId, type: CaptainBalanceTransactionType.DEDUCTION },
    });

    if (!prepaid) {
      missingMirror.push({
        orderId,
        captainId,
        ledgerAmountAbs: ledgerAbs.toFixed(2),
        reason: "no_prepaid_deduction",
      });
      continue;
    }
    if (!money(prepaid.amount).equals(ledgerAbs)) {
      amountMismatch.push({
        orderId,
        captainId,
        ledgerAbs: ledgerAbs.toFixed(2),
        prepaidAmount: money(prepaid.amount).toFixed(2),
      });
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        scope: { since: since ?? "all" },
        ledgerCaptainDeliverLines: ledgerRows.length,
        missingPrepaidMirror: missingMirror.length,
        amountMismatches: amountMismatch.length,
        missingMirrorSample: missingMirror.slice(0, 50),
        amountMismatchSample: amountMismatch.slice(0, 50),
      },
      null,
      2,
    ),
  );

  if (amountMismatch.length > 0) {
    process.exitCode = 1;
  }
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
