import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useCaptainAssignment } from "@/hooks/api/use-captain-assignment";
import { queryKeys } from "@/hooks/api/query-keys";
import { getCaptainSocket } from "@/services/socket/socket-client";

const DISCONNECTED_POLL_MS = 22_000;
const MAX_EXPIRY_SCHEDULE_MS = 12 * 60 * 1000;
const NEAR_EXPIRY_LEAD_MS = 3500;

/**
 * احتياطي خفيف عندما لا يصل حدث Socket:
 * - قبل انتهاء مهلة العرض بقليل: إعادة جلب التعيين
 * - أثناء انقطاع الـ socket: استطلاع خفيف للتعيين
 */
export function useAssignmentFallbackPolling(enabled: boolean): void {
  const queryClient = useQueryClient();
  const assignmentQuery = useCaptainAssignment({
    enabled,
    staleTime: 12_000,
  });

  /** قرب انتهاء عرض OFFER */
  useEffect(() => {
    if (!enabled) return;
    const data = assignmentQuery.data;
    if (!data || data.state !== "OFFER" || !data.log.expiresAt) return;

    const expMs = new Date(data.log.expiresAt).getTime();
    const delay = expMs - Date.now() - NEAR_EXPIRY_LEAD_MS;
    if (delay < 0 || delay > MAX_EXPIRY_SCHEDULE_MS) return;

    const t = setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.captain.assignment });
    }, delay);
    return () => clearTimeout(t);
  }, [enabled, assignmentQuery.data, queryClient]);

  /** استطلاع عند انقطاع الاتصال بالخادم اللحظي */
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      const s = getCaptainSocket();
      if (s && !s.connected) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.captain.assignment });
      }
    }, DISCONNECTED_POLL_MS);
    return () => clearInterval(id);
  }, [enabled, queryClient]);
}
