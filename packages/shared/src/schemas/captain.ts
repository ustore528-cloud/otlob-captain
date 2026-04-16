import { z } from "zod";

export const UpsertCaptainProfileBodySchema = z.object({
  displayName: z.string().min(1).max(120),
  phone: z.string().min(5).max(32),
  vehicleInfo: z.string().max(200).optional(),
});

export type UpsertCaptainProfileBody = z.infer<typeof UpsertCaptainProfileBodySchema>;

export const CaptainAvailabilityBodySchema = z.object({
  isActive: z.boolean(),
});

export type CaptainAvailabilityBody = z.infer<typeof CaptainAvailabilityBodySchema>;

export const CaptainLocationBodySchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  heading: z.number().optional(),
  speedMps: z.number().optional(),
});

export type CaptainLocationBody = z.infer<typeof CaptainLocationBodySchema>;

export const CaptainDtoSchema = z.object({
  id: z.string(),
  userId: z.string(),
  displayName: z.string(),
  phone: z.string(),
  vehicleInfo: z.string().nullable(),
  isActive: z.boolean(),
  currentLatitude: z.number().nullable(),
  currentLongitude: z.number().nullable(),
  lastLocationAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime(),
});

export type CaptainDto = z.infer<typeof CaptainDtoSchema>;
