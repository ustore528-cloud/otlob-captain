import { z } from "zod";
import { OrderStatus, DistributionMode, $Enums } from "@prisma/client";
import { PaginationQuerySchema } from "./pagination.schemas.js";

export const OrderIdParamSchema = z.object({
  id: z.string().cuid(),
});

export const CreateOrderBodySchema = z.object({
  storeId: z.string().cuid().optional(),
  /** ربط اختياري بحساب عميل — وإلا يُستنتج من تطابق رقم الهاتف مع مستخدم CUSTOMER */
  customerUserId: z.string().cuid().optional(),
  customerName: z.string().min(1).max(200),
  customerPhone: z.string().min(5).max(32),
  pickupAddress: z.string().min(1).max(500),
  dropoffAddress: z.string().min(1).max(500),
  area: z.string().min(1).max(200),
  amount: z.coerce.number().nonnegative(),
  cashCollection: z.coerce.number().nonnegative().optional(),
  dropoffLatitude: z.number().min(-90).max(90).optional(),
  dropoffLongitude: z.number().min(-180).max(180).optional(),
  notes: z.string().max(2000).optional(),
  distributionMode: z.nativeEnum(DistributionMode).optional(),
});

export const ListOrdersQuerySchema = PaginationQuerySchema.extend({
  storeId: z.string().cuid().optional(),
  status: z.nativeEnum(OrderStatus).optional(),
  area: z.string().optional(),
  orderNumber: z.string().optional(),
  customerPhone: z.string().optional(),
});

export const UpdateOrderStatusBodySchema = z.object({
  status: z.nativeEnum(OrderStatus),
});

export const ReassignBodySchema = z.object({
  captainId: z.string().cuid(),
});

export const ManualAssignBodySchema = z
  .object({
    captainId: z.string().cuid(),
    /** افتراضي MANUAL — أو DRAG_DROP (نفس مسار drag-drop منفصل) */
    assignmentType: z.nativeEnum($Enums.AssignmentType).optional(),
  })
  .refine(
    (d) =>
      d.assignmentType === undefined ||
      d.assignmentType === $Enums.AssignmentType.MANUAL ||
      d.assignmentType === $Enums.AssignmentType.DRAG_DROP,
    { message: "assignmentType must be MANUAL or DRAG_DROP" },
  );

export const DragDropAssignBodySchema = z.object({
  captainId: z.string().cuid(),
});

/** حالات مسموح بها لمسار الإشراف فقط — لا ASSIGNED/ACCEPTED/… (تستخدم مسارات التوزيع والكابتن) */
export const AdminOverrideOrderStatusBodySchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "CANCELLED", "DELIVERED"]),
});
