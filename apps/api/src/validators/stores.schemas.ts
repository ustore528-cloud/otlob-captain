import { z } from "zod";
import { PaginationQuerySchema } from "./pagination.schemas.js";

/** Backward-compatible support for the long-lived seeded demo store ID. */
export const StoreIdSchema = z.union([z.string().cuid(), z.literal("seed-store-main")]);

export const StoreIdParamSchema = z.object({
  id: StoreIdSchema,
});

export const CreateStoreBodySchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().min(5).max(32),
  area: z.string().min(1).max(200),
  address: z.string().min(1).max(500),
  ownerUserId: z.string().cuid(),
  /** يُستنتج تلقائياً عند فرع واحد نشط للشركة */
  branchId: z.string().cuid().optional(),
});

export const UpdateStoreBodySchema = CreateStoreBodySchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const ListStoresQuerySchema = PaginationQuerySchema.extend({
  area: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});
