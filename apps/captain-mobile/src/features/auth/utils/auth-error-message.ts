import { ApiClientError } from "@/services/api/errors";

export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "INVALID_CREDENTIALS") {
      return "رقم الجوال/البريد أو كلمة المرور غير صحيحة.";
    }
    if (error.code === "FORBIDDEN_ROLE") {
      return "هذا التطبيق مخصّص لحسابات الكابتن فقط.";
    }
    if (error.code === "FORBIDDEN") {
      return "ملف الكابتن غير متوفر لهذا الحساب.";
    }
    return error.message || "تعذّر تسجيل الدخول.";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "حدث خطأ غير متوقع.";
}
