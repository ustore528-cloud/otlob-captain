import { ApiClientError } from "@/services/api/errors";
import i18n from "@/i18n/i18n";

/**
 * Formats errors for UI — `fallback` should be a user-facing string (often from `t()`).
 */
export function formatUnknownError(error: unknown, fallback: string): string {
  if (error instanceof ApiClientError) {
    if (error.code === "OFFER_EXPIRED") return i18n.t("errors.offerExpired");
    if (error.code === "INVALID_STATE" && /pending assignment/i.test(error.message)) {
      return i18n.t("errors.noPendingAssignment");
    }
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}
