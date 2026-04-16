import { z } from "zod";
import { PaginationQuerySchema } from "./pagination.schemas.js";

export const CreateNotificationBodySchema = z.object({
  userId: z.string().cuid(),
  type: z.string().min(1).max(64),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(10000),
});

export const NotificationIdParamSchema = z.object({
  id: z.string().cuid(),
});

export const ListNotificationsQuerySchema = PaginationQuerySchema.extend({
  isRead: z.coerce.boolean().optional(),
});
