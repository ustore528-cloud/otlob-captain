import { z } from "zod";

export const CaptainLocationBodySchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).nullable().optional(),
  speed: z.number().min(0).nullable().optional(),
  accuracy: z.number().min(0).nullable().optional(),
  timestamp: z.string().datetime().nullable().optional(),
});

export const LatestLocationsQuerySchema = z.object({
  captainIds: z.string().optional(), // comma-separated cuid list
});
