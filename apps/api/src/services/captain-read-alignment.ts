import { Prisma } from "@prisma/client";
import { money } from "./ledger/money.js";

export type CaptainReadAlignmentParity = "OK" | "NO_WALLET" | "MISMATCH";

/**
 * Single scalar for prepaid product policy + distribution gating (same rule as `buildCaptainReadAlignment` when aligned).
 * When `useAligned` is false, always uses the prepaid book (legacy).
 */
export function getBalanceForPrepaidProductChecks(input: {
  useAligned: boolean;
  captainPrepaid: Prisma.Decimal;
  /** Null when there is no `wallet_accounts` row for this captain. */
  walletBalanceCached: Prisma.Decimal | null;
}): Prisma.Decimal {
  if (!input.useAligned) {
    return money(input.captainPrepaid);
  }
  if (input.walletBalanceCached != null) {
    return money(input.walletBalanceCached);
  }
  return money(input.captainPrepaid);
}

/**
 * Read-path alignment: single display number + support fields (no write / no repair).
 * Rule: if a captain wallet row exists, display wallet `balanceCached`; else display prepaid book balance.
 */
export function buildCaptainReadAlignment(input: {
  captainPrepaid: Prisma.Decimal;
  /** Null when there is no `wallet_accounts` row for this captain. */
  walletBalanceCached: Prisma.Decimal | null;
}): {
  displayBalance: string;
  walletBalance: string | null;
  prepaidBalance: string;
  parity: CaptainReadAlignmentParity;
} {
  const prepaidStr = money(input.captainPrepaid).toFixed(2);
  if (input.walletBalanceCached == null) {
    return {
      displayBalance: prepaidStr,
      walletBalance: null,
      prepaidBalance: prepaidStr,
      parity: "NO_WALLET",
    };
  }
  const w = money(input.walletBalanceCached);
  const walletStr = w.toFixed(2);
  const same = w.equals(money(input.captainPrepaid));
  return {
    displayBalance: walletStr,
    walletBalance: walletStr,
    prepaidBalance: prepaidStr,
    parity: same ? "OK" : "MISMATCH",
  };
}
