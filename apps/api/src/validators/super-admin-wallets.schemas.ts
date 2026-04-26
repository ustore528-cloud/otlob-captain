import { z } from "zod";
import { Prisma } from "@prisma/client";

const amountString = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Amount must be a positive decimal with at most 2 fractional digits")
  .refine((s) => new Prisma.Decimal(s).gt(0), "Amount must be positive");

const signedAmountString = z
  .string()
  .trim()
  .regex(/^-?\d+(\.\d{1,2})?$/, "Amount must be a signed decimal with at most 2 fractional digits")
  .refine((s) => !new Prisma.Decimal(s).equals(0), "Amount must be non-zero");

export const SuperAdminStoreIdParamSchema = z.object({
  storeId: z.string().cuid(),
});

export const SuperAdminSupervisorUserIdParamSchema = z.object({
  userId: z.string().cuid(),
});

export const SuperAdminWalletTopUpBodySchema = z.object({
  amount: z.preprocess((v) => {
    if (typeof v === "number" && Number.isFinite(v)) {
      return new Prisma.Decimal(v).toFixed(2);
    }
    return v;
  }, amountString),
  /** Defaults to the wallet / SAR when omitted in the ledger service path */
  currency: z.string().length(3).optional(),
});

export const SuperAdminSupervisorWalletAdjustmentBodySchema = z.object({
  amount: z.preprocess((v) => {
    if (typeof v === "number" && Number.isFinite(v)) {
      return new Prisma.Decimal(v).toFixed(2);
    }
    return v;
  }, signedAmountString),
  note: z.string().trim().min(1, "Reason is required"),
  currency: z.string().length(3).optional(),
});

export const SuperAdminCompanyIdParamSchema = z.object({
  companyId: z.string().cuid(),
});

export const SuperAdminCompanyWalletTopUpBodySchema = z.object({
  amount: z.preprocess((v) => {
    if (typeof v === "number" && Number.isFinite(v)) {
      return new Prisma.Decimal(v).toFixed(2);
    }
    return v;
  }, amountString),
  reason: z.string().trim().min(1, "Reason is required"),
  idempotencyKey: z.string().trim().min(1, "idempotencyKey is required").max(256),
  currency: z.string().length(3).optional(),
});
