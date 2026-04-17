import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/api/query-keys";

/**
 * تحديث الواجهات التي تعتمد على التعيين والإشعارات وبيانات الكابتن.
 * الخادم لا يبث حدث إشعار منفصل حاليًا — نحدّث قائمة الإشعارات عند أحداث الطلب/التعيين كأفضل جهد.
 */
export function invalidateCaptainRealtimeQueries(queryClient: QueryClient, _reason: string): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.captain.assignment });
  void queryClient.invalidateQueries({ queryKey: queryKeys.captain.me });
  void queryClient.invalidateQueries({ queryKey: ["captain-mobile", "notifications", "list"] });
}
