import { apiFetch, paths } from "@/lib/api/http";
import type {
  CompanyWalletReadDto,
  FinanceLedgerHistoryPageDto,
  LedgerActivityReportDto,
  WalletBalanceReadDto,
} from "@/types/api";

const DEFAULT_LEDGER_LIMIT = 20;

function ledgerQuery(offset: number, limit: number) {
  const p = new URLSearchParams();
  p.set("offset", String(offset));
  p.set("limit", String(limit));
  return p.toString();
}

export function getStoreWallet(token: string, storeId: string): Promise<WalletBalanceReadDto> {
  return apiFetch<WalletBalanceReadDto>(paths.finance.storeWallet(storeId), { token });
}

export function getCaptainWallet(token: string, captainId: string): Promise<WalletBalanceReadDto> {
  return apiFetch<WalletBalanceReadDto>(paths.finance.captainWallet(captainId), { token });
}

export function getMySupervisorWallet(token: string): Promise<WalletBalanceReadDto> {
  return apiFetch<WalletBalanceReadDto>(paths.finance.supervisorMe, { token });
}

export function getMyCompanyWallet(token: string): Promise<CompanyWalletReadDto> {
  return apiFetch<CompanyWalletReadDto>(paths.finance.companyWalletMe, { token });
}

export function getCompanyWalletById(token: string, companyId: string): Promise<CompanyWalletReadDto> {
  return apiFetch<CompanyWalletReadDto>(paths.finance.companyWalletById(companyId), { token });
}

/** `POST /finance/stores/:id/company-top-up` — COMPANY_ADMIN. */
export type CompanyAdminStoreTopUpResult = {
  storeId: string;
  walletAccountId: string;
  ledgerEntryId: string;
  balanceBefore: string;
  balanceAfter: string;
  idempotent: boolean;
  idempotencyKey: string;
};

export function postCompanyAdminStoreTopUp(
  token: string,
  storeId: string,
  body: { amount: string; reason: string; idempotencyKey: string; currency?: string },
): Promise<CompanyAdminStoreTopUpResult> {
  return apiFetch<CompanyAdminStoreTopUpResult>(paths.finance.companyAdminStoreTopUp(storeId), {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

/** `POST /finance/captains/:id/prepaid-charge` — COMPANY_ADMIN / SUPER_ADMIN. */
export type CompanyAdminCaptainPrepaidResult = {
  idempotent: boolean;
  transaction: { id: string; captainId: string; amount: string; balanceAfter: string };
  ledgerEntryId: string;
  balanceAfter: string;
  prepaidBalance: string;
};

export function postCompanyAdminCaptainPrepaid(
  token: string,
  captainId: string,
  body: { amount: string; reason: string; idempotencyKey: string },
): Promise<CompanyAdminCaptainPrepaidResult> {
  return apiFetch<CompanyAdminCaptainPrepaidResult>(paths.finance.companyAdminCaptainPrepaid(captainId), {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

/** ينفَّذ عبر `POST /super-admin/wallets/company/:id/top-up` — انظر `topUpCompanyWallet` في `super-admin-wallets.ts` (idempotency في الـ body). */
export { topUpCompanyWallet } from "./super-admin-wallets";

export function getLedgerHistoryPage(
  token: string,
  walletAccountId: string,
  offset: number,
  limit = DEFAULT_LEDGER_LIMIT,
): Promise<FinanceLedgerHistoryPageDto> {
  return apiFetch<FinanceLedgerHistoryPageDto>(
    `${paths.finance.ledgerEntries(walletAccountId)}?${ledgerQuery(offset, limit)}`,
    { token },
  );
}

function ledgerActivityQuery(from: string, to: string, offset: number, limit: number) {
  const p = new URLSearchParams();
  p.set("from", from);
  p.set("to", to);
  p.set("offset", String(offset));
  p.set("limit", String(limit));
  return p.toString();
}

export function getLedgerActivityReport(
  token: string,
  walletAccountId: string,
  params: { from: string; to: string; offset: number; limit?: number },
): Promise<LedgerActivityReportDto> {
  const limit = params.limit ?? DEFAULT_LEDGER_LIMIT;
  return apiFetch<LedgerActivityReportDto>(
    `${paths.finance.ledgerActivity(walletAccountId)}?${ledgerActivityQuery(
      params.from,
      params.to,
      params.offset,
      limit,
    )}`,
    { token },
  );
}
