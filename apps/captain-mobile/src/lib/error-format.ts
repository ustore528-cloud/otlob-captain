import { ApiClientError } from "@/services/api/errors";

/**
 * تنسيق أخطاء موحّد للـ UI و Alert — لا يعتمد على نوع الخادم.
 */
export function formatUnknownError(error: unknown, fallback = "حدث خطأ غير متوقع."): string {
  if (error instanceof ApiClientError) {
    if (error.code === "OFFER_EXPIRED") return "انتهت مهلة قبول هذا العرض.";
    if (error.code === "INVALID_STATE" && /pending assignment/i.test(error.message)) {
      return "لا يوجد تعيين قابل للقبول لهذا الطلب (قد تكون المهلة انتهت أو أُعيد التوزيع).";
    }
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}
