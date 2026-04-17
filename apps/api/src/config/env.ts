import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** دائمًا `apps/api/.env` بغض النظر عن مجلد التشغيل (الجذر أو apps/api) */
loadEnv({ path: path.resolve(__dirname, "..", "..", ".env"), override: true });

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  /** افتراضيًا مفتوح للتطوير (موبايل على LAN، Expo). للإنتاج حدّد دومينات الويب صراحةً. */
  CORS_ORIGIN: z.string().default("*"),
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

if (env.NODE_ENV === "production") {
  const weakSecret = (v: string) => /^(change-me|dev|test|1234)/i.test(v) || v.length < 24;
  if (env.CORS_ORIGIN.trim() === "*") {
    throw new Error("CORS_ORIGIN must not be '*' in production.");
  }
  if (weakSecret(env.JWT_ACCESS_SECRET) || weakSecret(env.JWT_REFRESH_SECRET)) {
    throw new Error("JWT secrets are too weak for production. Use long random secrets.");
  }
}
