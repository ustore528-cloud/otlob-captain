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
