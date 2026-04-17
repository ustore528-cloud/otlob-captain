import { env } from "../../config/env.js";

/** مدة انتظار رد الكابتن (ثوانٍ) — قابل للاختبار عبر env */
export const DISTRIBUTION_TIMEOUT_SECONDS = env.DISTRIBUTION_TIMEOUT_SECONDS;

export const DISTRIBUTION_MAX_AUTO_ATTEMPTS = env.DISTRIBUTION_MAX_ATTEMPTS;

/** حد الحمل التلقائي لكل كابتن في نفس الوقت (اليدوي غير مقيّد). */
export const AUTO_CAPTAIN_MAX_ACTIVE_ORDERS = 2;

export const ASSIGNMENT_TIMEOUT_NOTE = (seconds: number) =>
  `TIMEOUT: no response within ${seconds}s (round-robin advance)`;
