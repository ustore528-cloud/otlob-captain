import { z } from "zod";

export const CaptainLocationBodySchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const LatestLocationsQuerySchema = z.object({
  captainIds: z.string().optional(), // comma-separated cuid list
});
