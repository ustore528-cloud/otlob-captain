import { z } from "zod";
import {
  AssignmentMethodSchema,
  AssignmentStatusSchema,
  OrderStatusSchema,
} from "../enums.js";

export const CreateOrderBodySchema = z.object({
  restaurantId: z.string().cuid(),
  pickupAddress: z.string().min(1).max(500),
  deliveryAddress: z.string().min(1).max(500),
  pickupLatitude: z.number().min(-90).max(90).optional(),
  pickupLongitude: z.number().min(-180).max(180).optional(),
  deliveryLatitude: z.number().min(-90).max(90).optional(),
  deliveryLongitude: z.number().min(-180).max(180).optional(),
  notes: z.string().max(2000).optional(),
});

export type CreateOrderBody = z.infer<typeof CreateOrderBodySchema>;

export const UpdateOrderStatusBodySchema = z.object({
  status: OrderStatusSchema,
});

export type UpdateOrderStatusBody = z.infer<typeof UpdateOrderStatusBodySchema>;

export const ManualAssignBodySchema = z.object({
  captainId: z.string().cuid(),
});

export type ManualAssignBody = z.infer<typeof ManualAssignBodySchema>;

export const OrderAssignmentDtoSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  captainId: z.string(),
  method: AssignmentMethodSchema,
  status: AssignmentStatusSchema,
  assignedAt: z.string().datetime(),
  acceptedAt: z.string().datetime().nullable(),
});

export type OrderAssignmentDto = z.infer<typeof OrderAssignmentDtoSchema>;

export const OrderDtoSchema = z.object({
  id: z.string(),
  restaurantId: z.string(),
  status: OrderStatusSchema,
  pickupAddress: z.string(),
  deliveryAddress: z.string(),
  pickupLatitude: z.number().nullable(),
  pickupLongitude: z.number().nullable(),
  deliveryLatitude: z.number().nullable(),
  deliveryLongitude: z.number().nullable(),
  notes: z.string().nullable(),
  createdById: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  assignments: z.array(OrderAssignmentDtoSchema).optional(),
});

export type OrderDto = z.infer<typeof OrderDtoSchema>;

export const OrderListQuerySchema = z.object({
  status: OrderStatusSchema.optional(),
  restaurantId: z.string().cuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type OrderListQuery = z.infer<typeof OrderListQuerySchema>;
