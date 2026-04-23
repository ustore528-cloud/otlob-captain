import { z } from "zod";
import { CaptainAvailabilityStatus, OrderStatus } from "@prisma/client";
import { PaginationQuerySchema } from "./pagination.schemas.js";

const VehicleTypeSchema = z.enum(["بسكليت", "دراجه ناريه", "سيارة", "شحن نقل"]);

/** سلسلة فارغة أو null من JSON لا تُعتبر «بدون بريد» مع z.email().optional() — تسبب فشل التحقق */
const optionalEmail = z.preprocess((v) => {
  if (v === "" || v === null || v === undefined) return undefined;
  return typeof v === "string" ? v.trim() : v;
}, z.string().email().optional());

export const CaptainIdParamSchema = z.object({
  id: z.string().cuid(),
});

export const CreateCaptainBodySchema = z.object({
  fullName: z.string().min(1).max(200).trim(),
  phone: z.string().min(5).max(32).trim(),
  email: optionalEmail,
  password: z.string().min(8),
  vehicleType: VehicleTypeSchema,
  area: z.string().min(1).max(200).trim(),
  branchId: z.string().cuid().optional(),
});

export const UpdateCaptainBodySchema = z.object({
  vehicleType: VehicleTypeSchema.optional(),
  area: z.string().min(1).max(200).optional(),
  isActive: z.boolean().optional(),
  prepaidEnabled: z.boolean().optional(),
  commissionPercent: z.union([z.number().finite().min(0).max(100), z.null()]).optional(),
  minimumBalanceToReceiveOrders: z.union([z.number().finite().min(0), z.null()]).optional(),
  /** للمدير / المشغّل فقط — تحديث بيانات المستخدم المرتبط */
  fullName: z.string().min(1).max(200).optional(),
  phone: z.string().min(5).max(32).optional(),
});

export const ListCaptainOrdersQuerySchema = PaginationQuerySchema.extend({
  from: z.string().optional(),
  to: z.string().optional(),
  q: z.string().max(200).optional(),
  area: z.string().max(200).optional(),
  status: z.nativeEnum(OrderStatus).optional(),
});

export const CaptainAvailabilityBodySchema = z.object({
  availabilityStatus: z.nativeEnum(CaptainAvailabilityStatus),
});

export const ListCaptainsQuerySchema = PaginationQuerySchema.extend({
  area: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  availabilityStatus: z.nativeEnum(CaptainAvailabilityStatus).optional(),
});

export const CaptainPrepaidChargeBodySchema = z.object({
  amount: z.number().finite().positive(),
  note: z.string().max(500).trim().optional(),
});

export const CaptainPrepaidAdjustmentBodySchema = z.object({
  amount: z.number().finite().refine((value) => value !== 0, "Amount cannot be zero"),
  note: z.string().min(3).max(500).trim(),
});
