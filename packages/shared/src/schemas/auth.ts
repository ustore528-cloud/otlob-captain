import { z } from "zod";
import { UserRoleSchema } from "../enums.js";

/** تسجيل الدخول — هاتف أو بريد + كلمة المرور (مطابقة API) */
export const LoginBodySchema = z
  .object({
    phone: z.string().min(5).optional(),
    email: z.string().email().optional(),
    password: z.string().min(1),
  })
  .refine((d) => Boolean(d.phone?.trim() || d.email?.trim()), { message: "phone or email required" });

export type LoginBody = z.infer<typeof LoginBodySchema>;

export const AuthUserSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  phone: z.string(),
  email: z.string().nullable(),
  role: UserRoleSchema,
  isActive: z.boolean(),
  storeId: z.string().nullable(),
});

export type AuthUser = z.infer<typeof AuthUserSchema>;

export const LoginResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  user: AuthUserSchema,
});

export type LoginResponse = z.infer<typeof LoginResponseSchema>;
