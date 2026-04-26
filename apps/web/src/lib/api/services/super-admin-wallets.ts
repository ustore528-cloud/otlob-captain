import { apiFetch, paths } from "@/lib/api/http";
import type { CompanyWalletTopUpResultDto, WalletTopUpResultDto } from "@/types/api";

export function topUpStoreWallet(
  token: string,
  storeId: string,
  input: { amount: string; idempotencyKey: string },
): Promise<WalletTopUpResultDto> {
  return apiFetch<WalletTopUpResultDto>(paths.superAdminWallets.storeTopUp(storeId), {
    method: "POST",
    token,
    body: JSON.stringify({ amount: input.amount }),
    idempotencyKey: input.idempotencyKey,
  });
}

export function topUpSupervisorUserWallet(
  token: string,
  userId: string,
  input: { amount: string; idempotencyKey: string },
): Promise<WalletTopUpResultDto> {
  return apiFetch<WalletTopUpResultDto>(paths.superAdminWallets.supervisorUserTopUp(userId), {
    method: "POST",
    token,
    body: JSON.stringify({ amount: input.amount }),
    idempotencyKey: input.idempotencyKey,
  });
}

export function adjustSupervisorUserWallet(
  token: string,
  userId: string,
  input: { amount: string; note: string; idempotencyKey: string },
): Promise<WalletTopUpResultDto> {
  return apiFetch<WalletTopUpResultDto>(paths.superAdminWallets.supervisorUserAdjustment(userId), {
    method: "POST",
    token,
    body: JSON.stringify({ amount: input.amount, note: input.note }),
    idempotencyKey: input.idempotencyKey,
  });
}

/**
 * شحن محفظة الشركة (مدير النظام فقط).
 * مهم: الخادم يتوقع `idempotencyKey` داخل جسم JSON، وليس ترويسة `Idempotency-Key` (بخلاف `topUpStoreWallet` / المشرف).
 */
export function topUpCompanyWallet(
  token: string,
  companyId: string,
  input: { amount: string; reason: string; idempotencyKey: string; currency?: string },
): Promise<CompanyWalletTopUpResultDto> {
  return apiFetch<CompanyWalletTopUpResultDto>(paths.superAdminWallets.companyTopUp(companyId), {
    method: "POST",
    token,
    body: JSON.stringify({
      amount: input.amount,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
      ...(input.currency && input.currency.trim() !== "" ? { currency: input.currency.trim() } : {}),
    }),
  });
}
