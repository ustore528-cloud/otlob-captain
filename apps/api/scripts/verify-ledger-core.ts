/**
 * Internal smoke test for the ledger service (Slice 2).
 * Run from `apps/api`: `npm run verify:ledger-core` (requires DB + migrations).
 */
import "dotenv/config";
import { LedgerEntryType, WalletOwnerType, Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";
import {
  appendLedgerEntry,
  ensureWalletAccount,
  money,
  transfer,
} from "../src/services/ledger/index.js";

function makeOwnerIds() {
  const run = `run-${Date.now()}`;
  return { a: `ledger-core-captain-a-${run}`, b: `ledger-core-captain-b-${run}` };
}

function assertEq(actual: string, expected: string, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

async function main() {
  const company =
    (await prisma.company.findFirst()) ??
    (await prisma.company.create({ data: { name: "ledger-core-verify" } }));

  const { a: idA, b: idB } = makeOwnerIds();
  const a = await ensureWalletAccount({
    ownerType: WalletOwnerType.CAPTAIN,
    ownerId: idA,
    companyId: company.id,
  });
  const b = await ensureWalletAccount({
    ownerType: WalletOwnerType.CAPTAIN,
    ownerId: idB,
    companyId: company.id,
  });

  const keyAppend = `verify-append-${Date.now()}`;
  const r1 = await appendLedgerEntry({
    walletAccountId: a.id,
    entryType: LedgerEntryType.ADJUSTMENT,
    amount: new Prisma.Decimal("25.00"),
    idempotencyKey: keyAppend,
  });
  if (r1.idempotent) {
    throw new Error("first append should not be idempotent");
  }
  const r2 = await appendLedgerEntry({
    walletAccountId: a.id,
    entryType: LedgerEntryType.ADJUSTMENT,
    amount: new Prisma.Decimal("25.00"),
    idempotencyKey: keyAppend,
  });
  if (!r2.idempotent) {
    throw new Error("second append with same key should be idempotent");
  }
  if (r1.entry.id !== r2.entry.id) {
    throw new Error("idempotent replay should return the same entry id");
  }
  const aAfterAppend = await prisma.walletAccount.findUniqueOrThrow({ where: { id: a.id } });
  assertEq(money(aAfterAppend.balanceCached).toFixed(2), "25.00", "balance after one append + one replay");

  const keyTransfer = `verify-transfer-${Date.now()}`;
  const t1 = await transfer({
    fromAccountId: a.id,
    toAccountId: b.id,
    amount: 10,
    idempotencyKey: keyTransfer,
  });
  if (t1.idempotent) {
    throw new Error("first transfer should not be idempotent");
  }
  const t2 = await transfer({
    fromAccountId: a.id,
    toAccountId: b.id,
    amount: 10,
    idempotencyKey: keyTransfer,
  });
  if (!t2.idempotent) {
    throw new Error("second transfer with same key should be idempotent");
  }
  if (t1.from.id !== t2.from.id || t1.to.id !== t2.to.id) {
    throw new Error("idempotent transfer should return the same leg rows");
  }

  const aFinal = await prisma.walletAccount.findUniqueOrThrow({ where: { id: a.id } });
  const bFinal = await prisma.walletAccount.findUniqueOrThrow({ where: { id: b.id } });
  assertEq(money(aFinal.balanceCached).toFixed(2), "15.00", "A balance 25-10");
  assertEq(money(bFinal.balanceCached).toFixed(2), "10.00", "B balance +10");

  // eslint-disable-next-line no-console
  console.info("[verify-ledger-core] passed");
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
