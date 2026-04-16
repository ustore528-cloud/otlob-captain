import { api } from "@/lib/api/singleton";
import type { ApiClient } from "@/lib/api/client";

/** يعيد عميل REST الموحّد — نفس المثيل للويب؛ لاحقاً يمكن حقن عميل آخر للاختبار أو للتطبيق. */
export function useApiClient(): ApiClient {
  return api;
}
