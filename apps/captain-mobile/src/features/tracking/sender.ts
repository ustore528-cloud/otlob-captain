import type { CaptainLocationRecordDto, UpdateCaptainLocationBody } from "@/services/api/dto";
import { trackingService } from "@/services/api/services/tracking.service";
import { TRACKING_CONFIG } from "./config";
import { shouldRetrySend } from "./error-classify";

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function backoffMs(attempt: number): number {
  const base = TRACKING_CONFIG.sendRetryBaseMs * 2 ** attempt;
  const jitter = Math.floor(Math.random() * 200);
  return Math.min(base + jitter, 15_000);
}

/**
 * إرسال إلى الخادم مع إعادة المحاولة عند فشل مؤقت (شبكة / 5xx).
 */
export async function sendCaptainLocationReliable(
  body: UpdateCaptainLocationBody,
): Promise<CaptainLocationRecordDto> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < TRACKING_CONFIG.sendMaxAttempts; attempt++) {
    try {
      return await trackingService.sendLocation(body);
    } catch (e) {
      lastErr = e;
      if (!shouldRetrySend(e) || attempt === TRACKING_CONFIG.sendMaxAttempts - 1) {
        throw e;
      }
      await delay(backoffMs(attempt));
    }
  }
  throw lastErr;
}
