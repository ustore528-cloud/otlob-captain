import { z } from "zod";
import { Prisma } from "@prisma/client";

const amountString = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Amount must be a positive decimal with at most 2 fractional digits")
  .refine((s) => new Prisma.Decimal(s).gt(0), "Amount must be positive");

export const SupervisorCaptainTransferBodySchema = z.object({
  captainId: z.string().cuid(),
  amount: z.preprocess((v) => {
    if (typeof v === "number" && Number.isFinite(v)) {
      return new Prisma.Decimal(v).toFixed(2);
    }
    return v;
  }, amountString),
  currency: z.string().length(3).optional(),
});
