import { z } from "zod";
import { UserRole } from "@prisma/client";
import { PaginationQuerySchema } from "./pagination.schemas.js";

export const UserListQuerySchema = PaginationQuerySchema.extend({
  role: z.nativeEnum(UserRole).optional(),
});

export const UserIdParamSchema = z.object({
  id: z.string().cuid(),
});

export const UserActiveBodySchema = z.object({
  isActive: z.boolean(),
});

export const CreateUserBodySchema = z.object({
  fullName: z.string().min(1).max(200),
  phone: z.string().min(5).max(32),
  email: z.string().email().optional(),
  password: z.string().min(8),
  role: z.nativeEnum(UserRole),
});

const optionalHttpsUrl = z.preprocess(
  (v) => (v === "" ? null : v),
  z
    .union([z.string().max(2000), z.null()])
    .optional()
    .refine(
      (s) =>
        s === undefined ||
        s === null ||
        (() => {
          try {
            const u = new URL(s);
            return u.protocol === "http:" || u.protocol === "https:";
          } catch {
            return false;
          }
        })(),
      { message: "Invalid URL" },
    ),
);

/** تحديث حقول «عميل» على مستخدم بدور CUSTOMER — نفس منطق حقول طلب جديد */
export const UpdateCustomerProfileBodySchema = z
  .object({
    customerPickupAddress: z.union([z.string().max(500), z.null()]).optional(),
    customerDropoffAddress: z.union([z.string().max(500), z.null()]).optional(),
    customerLocationLink: optionalHttpsUrl,
    customerArea: z.union([z.string().max(200), z.null()]).optional(),
    customerDropoffLat: z.union([z.number(), z.null()]).optional(),
    customerDropoffLng: z.union([z.number(), z.null()]).optional(),
    customerPreferredAmount: z.union([z.number().nonnegative(), z.null()]).optional(),
    customerPreferredDelivery: z.union([z.number().nonnegative(), z.null()]).optional(),
  })
  .strict()
  .refine(
    (d) => {
      const latU = d.customerDropoffLat;
      const lngU = d.customerDropoffLng;
      if (latU === undefined && lngU === undefined) return true;
      if (latU === null && lngU === null) return true;
      if (typeof latU === "number" && typeof lngU === "number") return true;
      return false;
    },
    { message: "Latitude and longitude must be sent together or both cleared" },
  );
