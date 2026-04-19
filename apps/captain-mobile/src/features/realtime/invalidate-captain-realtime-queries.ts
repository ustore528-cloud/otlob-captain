import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/api/query-keys";
import { logCaptainAssignment } from "@/lib/captain-assignment-debug";

/**
 * تحديث الواجهات التي تعتمد على التعيين والإشعارات وبيانات الكابتن.
 * الخادم لا يبث حدث إشعار منفصل حاليًا — نحدّث قائمة الإشعارات عند أحداث الطلب/التعيين كأفضل جهد.
 */
export function invalidateCaptainRealtimeQueries(queryClient: QueryClient, reason: string): void {
  logCaptainAssignment("SOCKET_INVALIDATE", { reason });
  void queryClient.invalidateQueries({ queryKey: queryKeys.captain.assignment });
  void queryClient.invalidateQueries({ queryKey: queryKeys.captain.me });
  /** أي شاشة تفاصيل طلب مفتوحة — إلا تبقى مع بيانات قديمة وزر قبول ظاهر خطأ */
  void queryClient.invalidateQueries({ queryKey: ["captain-mobile", "orders", "detail"] });
  void queryClient.invalidateQueries({ queryKey: ["captain-mobile", "notifications", "list"] });
  /** يظهر الطلب الجديد في سجل الطلبات دون انتظار السحب اليدوي */
  void queryClient.invalidateQueries({ queryKey: ["captain-mobile", "orders", "historyInfinite"] });
  /** يطابق مسار الطفرات بعد قبول/رفض — قوائم بفلاتر مختلفة */
  void queryClient.invalidateQueries({ queryKey: ["captain-mobile", "orders", "history"] });
  void queryClient.invalidateQueries({ queryKey: queryKeys.captain.workStatus });
}
