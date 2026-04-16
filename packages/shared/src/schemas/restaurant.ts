import { z } from "zod";

export const CreateRestaurantBodySchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().min(5).max(32),
  address: z.string().min(1).max(500),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export type CreateRestaurantBody = z.infer<typeof CreateRestaurantBodySchema>;

export const UpdateRestaurantBodySchema = CreateRestaurantBodySchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type UpdateRestaurantBody = z.infer<typeof UpdateRestaurantBodySchema>;

export const RestaurantDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  address: z.string(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type RestaurantDto = z.infer<typeof RestaurantDtoSchema>;
