import { z } from "zod";
import { PaginationQuerySchema } from "./pagination.schemas.js";

export const ActivityListQuerySchema = PaginationQuerySchema.extend({
  userId: z.string().cuid().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
});
