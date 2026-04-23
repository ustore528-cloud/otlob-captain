import { z } from "zod";
import { StoreSubscriptionType } from "@prisma/client";
import { PaginationQuerySchema } from "./pagination.schemas.js";

/** Backward-compatible support for the long-lived seeded demo store ID. */
export const StoreIdSchema = z.union([z.string().cuid(), z.literal("seed-store-main")]);

export const StoreIdParamSchema = z.object({
  id: StoreIdSchema,
});

const StoreCreateFieldsSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().min(5).max(32),
  area: z.string().min(1).max(200),
  address: z.string().min(1).max(500),
  ownerUserId: z.string().cuid(),
  /** يُستنتج تلقائياً عند فرع واحد نشط للشركة */
  branchId: z.string().cuid().optional(),
  /** Phase B slice 2 — default PUBLIC in service if omitted */
  subscriptionType: z.nativeEnum(StoreSubscriptionType).optional(),
  /** Required when subscriptionType is SUPERVISOR_LINKED; must be null/absent for PUBLIC */
  supervisorUserId: z.string().cuid().nullable().optional(),
});

export const CreateStoreBodySchema = StoreCreateFieldsSchema.superRefine((data, ctx) => {
  const t = data.subscriptionType ?? StoreSubscriptionType.PUBLIC;
  if (t === StoreSubscriptionType.PUBLIC && data.supervisorUserId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["supervisorUserId"],
      message: "PUBLIC store must not have a supervisor",
    });
  }
  if (t === StoreSubscriptionType.SUPERVISOR_LINKED && !data.supervisorUserId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["supervisorUserId"],
      message: "SUPERVISOR_LINKED store requires supervisorUserId",
    });
  }
});

export const UpdateStoreBodySchema = StoreCreateFieldsSchema.partial()
  .extend({ isActive: z.boolean().optional() })
  .superRefine((data, ctx) => {
    if (data.subscriptionType === StoreSubscriptionType.PUBLIC && data.supervisorUserId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["supervisorUserId"],
        message: "PUBLIC store must not have a supervisor",
      });
    }
    if (data.subscriptionType === StoreSubscriptionType.SUPERVISOR_LINKED && data.supervisorUserId === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["supervisorUserId"],
        message: "Do not set supervisorUserId to null for SUPERVISOR_LINKED; change subscription or provide an id",
      });
    }
  });

export const ListStoresQuerySchema = PaginationQuerySchema.extend({
  area: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});
