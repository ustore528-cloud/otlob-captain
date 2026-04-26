import { z } from "zod";

/** أدوار المستخدمين — مطابقة Prisma / API */
export const UserRoleSchema = z.enum([
  "SUPER_ADMIN",
  "COMPANY_ADMIN",
  "BRANCH_MANAGER",
  "CAPTAIN_SUPERVISOR",
  "STORE_ADMIN",
  "STORE_USER",
  "DISPATCHER",
  "CAPTAIN",
  "CUSTOMER",
]);
export type UserRole = z.infer<typeof UserRoleSchema>;

/** @deprecated استخدم UserRoleSchema */
export const RoleSchema = UserRoleSchema;
export type Role = UserRole;

export const OrderStatusSchema = z.enum([
  "PENDING",
  "CONFIRMED",
  "ASSIGNED",
  "ACCEPTED",
  "PICKED_UP",
  "IN_TRANSIT",
  "DELIVERED",
  "CANCELLED",
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const AssignmentMethodSchema = z.enum(["AUTO", "MANUAL"]);
export type AssignmentMethod = z.infer<typeof AssignmentMethodSchema>;

export const AssignmentStatusSchema = z.enum(["PENDING", "ACCEPTED", "REJECTED", "CANCELLED", "EXPIRED"]);
export type AssignmentStatus = z.infer<typeof AssignmentStatusSchema>;
