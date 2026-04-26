import { z } from "zod";
import { OrderStatus, DistributionMode, $Enums } from "@prisma/client";
import { PaginationQuerySchema } from "./pagination.schemas.js";
import { StoreIdSchema } from "./stores.schemas.js";

export const OrderIdParamSchema = z.object({
  id: z.string().cuid(),
});

/**
 * Order money is normalized in `ordersService.create` via `resolveCanonicalOrderMoneyOnCreate`:
 * - `amount` = store amount
 * - `delivery_fee` = delivery fee (omit or null → derived from `cash_collection − amount` when cash sent; else **0**)
 * - `cash_collection` = customer collection (omit → **amount + delivery_fee**)
 * Invariant: **cash_collection = amount + delivery_fee** (two-decimal half-up).
 */
export const CreateOrderBodySchema = z.object({
  storeId: StoreIdSchema.optional(),
  /** Ignored by backend; company is always derived from selected store. */
  companyId: z.string().cuid().optional(),
  /** Ignored by backend; branch is always derived from selected store. */
  branchId: z.string().cuid().optional(),
  /** ربط اختياري بحساب عميل — وإلا يُستنتج من تطابق رقم الهاتف مع مستخدم CUSTOMER */
  customerUserId: z.string().cuid().optional(),
  customerName: z.string().min(1).max(200),
  customerPhone: z.string().min(5).max(32),
  pickupAddress: z.string().min(1).max(500),
  dropoffAddress: z.string().min(1).max(500),
  area: z.string().min(1).max(200),
  amount: z.coerce.number().nonnegative(),
  /** Customer collection total; optional — server computes `amount + delivery_fee` when omitted. */
  cashCollection: z.coerce.number().nonnegative().optional(),
  pickupLatitude: z.number().min(-90).max(90).optional(),
  pickupLongitude: z.number().min(-180).max(180).optional(),
  dropoffLatitude: z.number().min(-90).max(90).optional(),
  dropoffLongitude: z.number().min(-180).max(180).optional(),
  /** Delivery fee (may be **0**). Optional — derived from `cash_collection` when that field is sent without fee. */
  deliveryFee: z.coerce.number().nonnegative().optional(),
  notes: z.string().max(2000).optional(),
  distributionMode: z.nativeEnum(DistributionMode).optional(),
  zoneId: z.string().cuid().optional(),
});

export const ListOrdersQuerySchema = PaginationQuerySchema.extend({
  storeId: StoreIdSchema.optional(),
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

export const AutoAssignVisibleBodySchema = z.object({
  orderIds: z.array(z.string().cuid()).min(1).max(500),
  zoneId: z.string().cuid().optional(),
});

/** حالات مسموح بها لمسار الإشراف فقط — لا ASSIGNED/ACCEPTED/… (تستخدم مسارات التوزيع والكابتن) */
export const AdminOverrideOrderStatusBodySchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "CANCELLED", "DELIVERED"]),
});
