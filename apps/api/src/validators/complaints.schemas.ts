import { z } from "zod";
import { PublicPageComplaintStatus } from "@prisma/client";

const ownerCodeParam = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, "Invalid owner code");

export const PublicComplaintParamsSchema = z.object({
  ownerCode: ownerCodeParam,
});

export const PublicComplaintBodySchema = z.object({
  customerName: z.string().trim().min(1).max(200),
  customerPhone: z.string().trim().min(5).max(40),
  complaintType: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(8000),
});

export const StaffComplaintIdParamsSchema = z.object({
  id: z.string().cuid(),
});

export const ComplaintPatchStatusSchema = z.object({
  status: z.nativeEnum(PublicPageComplaintStatus),
});
