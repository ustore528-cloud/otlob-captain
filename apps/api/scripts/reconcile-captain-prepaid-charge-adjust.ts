/**
 * CHARGE / ADJUSTMENT alignment: `captain_balance_transactions` ↔ `ledger_entries` via `prepaid_ledger_operation_id`
 * and `reference_type` = CAPTAIN_PREPAID_OP. Read-only.
 * Run from `apps/api`: `npm run reconcile:captain-prepaid-charge-adjust`
 * Optional: `SINCE` = ISO date → filter `captain_balance_transactions.created_at >= SINCE`
 */
import "dotenv/config";
import {
  CaptainBalanceTransactionType,
  LedgerEntryType,
  Prisma,
} from "@prisma/client";
import { LEDGER_REF_CAPTAIN_PREPAID_OP } from "../src/config/captain-prepaid-ledger.js";
import { prisma } from "../src/lib/prisma.js";
import { money } from "../src/services/ledger/money.js";

const CHARGE_ADJUST: CaptainBalanceTransactionType[] = [
  CaptainBalanceTransactionType.CHARGE,
  CaptainBalanceTransactionType.ADJUSTMENT,
];

async function main() {
  const since = process.env.SINCE;
  const whereCbt: Prisma.CaptainBalanceTransactionWhereInput = {
    type: { in: CHARGE_ADJUST },
    ...(since ? { createdAt: { gte: new Date(since) } } : {}),
  };

  const cbts = await prisma.captainBalanceTransaction.findMany({
    where: whereCbt,
    orderBy: { createdAt: "asc" },
  });

  const missingLedger: Array<{
    captainBalanceTxId: string;
    captainId: string;
    type: string;
    prepaidLedgerOperationId: string | null;
    reason: string;
  }> = [];
  const amountMismatch: Array<{
    captainBalanceTxId: string;
    captainId: string;
    opId: string;
    cbtAmount: string;
    ledgerAmount: string;
  }> = [];

  for (const row of cbts) {
    const opId = row.prepaidLedgerOperationId;
    if (!opId) {
      missingLedger.push({
        captainBalanceTxId: row.id,
        captainId: row.captainId,
        type: row.type,
        prepaidLedgerOperationId: null,
        reason: "no_prepaid_ledger_operation_id",
      });
      continue;
    }

    const wantType =
      row.type === CaptainBalanceTransactionType.CHARGE
        ? LedgerEntryType.CAPTAIN_PREPAID_CHARGE
        : LedgerEntryType.CAPTAIN_PREPAID_ADJUSTMENT;

    const le = await prisma.ledgerEntry.findFirst({
      where: {
        entryType: wantType,
        referenceType: LEDGER_REF_CAPTAIN_PREPAID_OP,
        referenceId: opId,
      },
    });

    if (!le) {
      missingLedger.push({
        captainBalanceTxId: row.id,
        captainId: row.captainId,
        type: row.type,
        prepaidLedgerOperationId: opId,
        reason: "no_matching_ledger",
      });
      continue;
    }

    if (!money(row.amount).equals(money(le.amount))) {
      amountMismatch.push({
        captainBalanceTxId: row.id,
        captainId: row.captainId,
        opId,
        cbtAmount: money(row.amount).toFixed(2),
        ledgerAmount: money(le.amount).toFixed(2),
      });
    }
  }

  const candidateLedger = await prisma.ledgerEntry.findMany({
    where: {
      entryType: { in: [LedgerEntryType.CAPTAIN_PREPAID_CHARGE, LedgerEntryType.CAPTAIN_PREPAID_ADJUSTMENT] },
      referenceType: LEDGER_REF_CAPTAIN_PREPAID_OP,
      referenceId: { not: null },
    },
  });
  const orphan: typeof candidateLedger = [];
  for (const e of candidateLedger) {
    const ref = e.referenceId;
    if (!ref) continue;
    const c = await prisma.captainBalanceTransaction.findFirst({ where: { prepaidLedgerOperationId: ref } });
    if (!c) {
      orphan.push(e);
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        scope: { since: since ?? "all" },
        captainBalanceTxRows: cbts.length,
        missingOrMismatchedLedger: missingLedger.length,
        amountMismatches: amountMismatch.length,
        orphanLedgerWithoutCbt: orphan.length,
        missingLedgerSample: missingLedger.slice(0, 50),
        amountMismatchSample: amountMismatch.slice(0, 50),
        orphanSample: orphan.slice(0, 20).map((e) => ({ id: e.id, referenceId: e.referenceId, amount: e.amount })),
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
