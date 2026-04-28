import { apiFetch, paths } from "@/lib/api/http";

import type { ValueTranslations } from "@/types/api";

export type CompanyListItem = {
  id: string;
  name: string;
  incubatorMotherName?: string | null;
  deliveryPricing: {
    mode: "FIXED" | "DISTANCE_BASED";
    fixedDeliveryFee: string | null;
    baseDeliveryFee: string | null;
    pricePerKm: string | null;
    roundingMode: "CEIL" | "ROUND" | "NONE";
  };
  displayI18n?: { name?: ValueTranslations };
};

export type CompanyDeletePreview = {
  companyId: string;
  companyName: string;
  isActive: boolean;
  archivedAt: null;
  usersCount: number;
  activeUsersCount: number;
  captainsCount: number;
  activeCaptainsCount: number;
  storesCount: number;
  ordersCount: number;
  activeNonTerminalOrdersCount: number;
  walletAccountsCount: number;
  ledgerEntriesCount: number;
  activityLogsByCompanyUserCount: number;
  companyWalletBalance: string;
  storeBalancesTotal: string;
  captainPrepaidTotal: string;
  canHardDelete: boolean;
  recommendedAction: "archive_company" | "manual_review" | "already_inactive";
  riskNotes: string[];
};

export type CompanyArchiveResult = {
  companyId: string;
  companyName: string;
  isActive: boolean;
  alreadyArchived: boolean;
};

export const ARCHIVE_COMPANY_PHRASE = "ARCHIVE COMPANY" as const;

export function listCompanies(token: string): Promise<CompanyListItem[]> {
  return apiFetch<CompanyListItem[]>(paths.companies.root, { token });
}

export function createCompany(
  token: string,
  body: {
    name: string;
    incubatorMotherName?: string;
    deliveryPricing: {
      deliveryPricingMode: "FIXED" | "DISTANCE_BASED";
      fixedDeliveryFee?: number;
      baseDeliveryFee?: number;
      pricePerKm?: number;
      deliveryFeeRoundingMode?: "CEIL" | "ROUND" | "NONE";
    };
  },
): Promise<CompanyListItem> {
  return apiFetch<CompanyListItem>(paths.companies.root, {
    method: "POST",
    body: JSON.stringify(body),
    token,
  });
}

export function updateCompany(
  token: string,
  companyId: string,
  body: {
    name?: string;
    incubatorMotherName?: string | null;
    deliveryPricing?: {
      deliveryPricingMode: "FIXED" | "DISTANCE_BASED";
      fixedDeliveryFee?: number;
      baseDeliveryFee?: number;
      pricePerKm?: number;
      deliveryFeeRoundingMode?: "CEIL" | "ROUND" | "NONE";
    };
  },
): Promise<CompanyListItem> {
  return apiFetch<CompanyListItem>(`${paths.companies.root}/${companyId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
    token,
  });
}

export function getCompanyDeletePreview(token: string, companyId: string): Promise<CompanyDeletePreview> {
  return apiFetch<CompanyDeletePreview>(paths.companies.deletePreview(companyId), { token });
}

export function archiveCompany(
  token: string,
  companyId: string,
  body: { confirmPhrase: string },
): Promise<CompanyArchiveResult> {
  return apiFetch<CompanyArchiveResult>(paths.companies.archive(companyId), {
    method: "POST",
    body: JSON.stringify(body),
    token,
  });
}
