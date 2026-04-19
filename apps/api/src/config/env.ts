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
  /**
   * Set to `"1"` for one-test structured logs on stdout (`[offer-diagnostics]`) when creating/reading offers.
   * Offer window duration is fixed in code (`OFFER_CONFIRMATION_WINDOW_SECONDS`), not env.
   */
  OFFER_DIAGNOSTICS: z.enum(["0", "1"]).default("0"),
  /**
   * تكرار فحص انتهاء المهلة (ms). إن كان كبيرًا جدًا يتأخر اكتشاف انتهاء الـ 30 ثانية بذلك القدر.
   * افتراضي 2 ثانية — أقصى 60 ثانية لتجنب تأخير دقائق بسبب إعداد خاطئ.
   */
  DISTRIBUTION_POLL_MS: z.coerce.number().int().min(1000).max(60_000).default(2000),
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

if (env.NODE_ENV !== "test") {
  // eslint-disable-next-line no-console
  console.info(
    `[config] OFFER_CONFIRMATION_WINDOW_SECONDS=30 (fixed) OFFER_DIAGNOSTICS=${env.OFFER_DIAGNOSTICS}`,
  );
}

if (env.NODE_ENV === "production" && env.DISTRIBUTION_POLL_MS > 5000) {
  // eslint-disable-next-line no-console
  console.warn(
    `[Distribution] DISTRIBUTION_POLL_MS=${env.DISTRIBUTION_POLL_MS} — انتهاء المهلات يُكتشف متأخرًا بما يصل لهذا القدر فوق نافذة الـ timeout؛ يُفضّل ≤5000 في الإنتاج.`,
  );
}

if (env.NODE_ENV === "production") {
  const weakSecret = (v: string) => /^(change-me|dev|test|1234)/i.test(v) || v.length < 24;
  if (env.CORS_ORIGIN.trim() === "*") {
    throw new Error("CORS_ORIGIN must not be '*' in production.");
  }
  if (weakSecret(env.JWT_ACCESS_SECRET) || weakSecret(env.JWT_REFRESH_SECRET)) {
    throw new Error("JWT secrets are too weak for production. Use long random secrets.");
  }
}
