import { z } from "zod";
import { CaptainAvailabilityStatus } from "@prisma/client";
import { PaginationQuerySchema } from "./pagination.schemas.js";

export const CaptainIdParamSchema = z.object({
  id: z.string().cuid(),
});

export const CreateCaptainBodySchema = z.object({
  fullName: z.string().min(1).max(200),
  phone: z.string().min(5).max(32),
  email: z.string().email().optional(),
  password: z.string().min(8),
  vehicleType: z.string().min(1).max(100),
  area: z.string().min(1).max(200),
});

export const UpdateCaptainBodySchema = z.object({
  vehicleType: z.string().min(1).max(100).optional(),
  area: z.string().min(1).max(200).optional(),
  isActive: z.boolean().optional(),
});

export const CaptainAvailabilityBodySchema = z.object({
  availabilityStatus: z.nativeEnum(CaptainAvailabilityStatus),
});

export const ListCaptainsQuerySchema = PaginationQuerySchema.extend({
  area: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  availabilityStatus: z.nativeEnum(CaptainAvailabilityStatus).optional(),
});
