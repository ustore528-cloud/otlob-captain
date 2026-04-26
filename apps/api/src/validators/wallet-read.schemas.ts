import { z } from "zod";
import { Prisma } from "@prisma/client";

const companyAdminStoreTopUpAmount = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Amount must be a positive decimal with at most 2 fractional digits")
  .refine((s) => new Prisma.Decimal(s).gt(0), "Amount must be positive");

export const StoreIdWalletParamSchema = z.object({
  storeId: z.string().cuid(),
});

export const CaptainIdWalletParamSchema = z.object({
  captainId: z.string().cuid(),
});

export const WalletAccountIdParamSchema = z.object({
  walletAccountId: z.string().cuid(),
});

export const CompanyWalletCompanyIdParamSchema = z.object({
  companyId: z.string().cuid(),
});

export const LedgerHistoryQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/** `from` / `to` are UTC instants (ISO-8601); validated in the service. */
export const LedgerActivityReportQuerySchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const CompanyAdminStoreTopUpBodySchema = z.object({
  amount: z.preprocess((v) => {
    if (typeof v === "number" && Number.isFinite(v)) {
      return new Prisma.Decimal(v).toFixed(2);
    }
    return v;
  }, companyAdminStoreTopUpAmount),
  reason: z.string().trim().min(1, "Reason is required"),
  idempotencyKey: z.string().trim().min(1, "idempotencyKey is required").max(256),
  /** Defaults via wallet/ledger when omitted (e.g. ILS) */
  currency: z.string().length(3).optional(),
});

/** POST `/finance/captains/:captainId/prepaid-charge` — idempotent charge (COMPANY_ADMIN / SUPER_ADMIN). */
export const FinanceCaptainPrepaidChargeBodySchema = z.object({
  amount: z.preprocess((v) => {
    if (typeof v === "number" && Number.isFinite(v)) {
      return new Prisma.Decimal(v).toFixed(2);
    }
    return v;
  }, companyAdminStoreTopUpAmount),
  reason: z.string().trim().min(1, "Reason is required"),
  idempotencyKey: z.string().trim().min(1, "idempotencyKey is required").max(256),
});
