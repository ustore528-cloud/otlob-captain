import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  DISTRIBUTION_TIMEOUT_SECONDS: z.coerce.number().int().min(5).max(300).default(30),
  DISTRIBUTION_POLL_MS: z.coerce.number().int().min(1000).default(5000),
  /** Max auto attempts per distribution cycle (round-robin rounds) */
  DISTRIBUTION_MAX_ATTEMPTS: z.coerce.number().int().min(1).default(30),
});

export type Env = z.infer<typeof EnvSchema>;

const merged = {
  ...process.env,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
};

export const env: Env = EnvSchema.parse(merged);
