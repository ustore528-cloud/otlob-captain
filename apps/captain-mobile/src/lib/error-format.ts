/**
 * تنسيق أخطاء موحّد للـ UI و Alert — لا يعتمد على نوع الخادم.
 */
export function formatUnknownError(error: unknown, fallback = "حدث خطأ غير متوقع."): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}
