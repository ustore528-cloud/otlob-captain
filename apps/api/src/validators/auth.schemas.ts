import { z } from "zod";
import { UserRole } from "@prisma/client";

export const LoginBodySchema = z
  .object({
    phone: z.string().min(5).optional(),
    email: z.string().email().optional(),
    password: z.string().min(1),
  })
  .refine((d) => Boolean(d.phone || d.email), { message: "phone or email required" });

export const RefreshBodySchema = z.object({
  refreshToken: z.string().min(10),
});

export const RegisterBodySchema = z.object({
  fullName: z.string().min(1).max(200),
  phone: z.string().min(5).max(32),
  email: z.string().email().optional(),
  password: z.string().min(8),
  role: z.nativeEnum(UserRole),
});
