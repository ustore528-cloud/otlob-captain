import type { QueryClient } from "@tanstack/react-query";
import type { Socket } from "socket.io-client";
import { CAPTAIN_SOCKET_EVENTS } from "@/services/realtime/captain-socket-events";
import { invalidateCaptainRealtimeQueries } from "./invalidate-captain-realtime-queries";

type RealtimeBannerEvent =
  | { type: "assignment"; payload: unknown }
  | { type: "assignment_ended"; payload: unknown }
  | { type: "order_updated"; payload: unknown };

/**
 * يربط أحداث الكابتن بـ React Query — يُستدعى `off` عند التنظيف أو إعادة الاتصال.
 */
export function attachCaptainRealtimeListeners(
  socket: Socket,
  queryClient: QueryClient,
  onRealtimeEvent?: (event: RealtimeBannerEvent) => void,
): () => void {
  const flush = (reason: string) => {
    invalidateCaptainRealtimeQueries(queryClient, reason);
  };

  const onAssignment = (payload: unknown) => {
    onRealtimeEvent?.({ type: "assignment", payload });
    flush("captain:assignment");
  };
  const onAssignmentEnded = (payload: unknown) => {
    onRealtimeEvent?.({ type: "assignment_ended", payload });
    flush("captain:assignment:ended");
  };
  const onOrderUpdated = (payload: unknown) => {
    onRealtimeEvent?.({ type: "order_updated", payload });
    flush("captain:order:updated");
  };

  socket.on(CAPTAIN_SOCKET_EVENTS.ASSIGNMENT, onAssignment);
  socket.on(CAPTAIN_SOCKET_EVENTS.ASSIGNMENT_ENDED, onAssignmentEnded);
  socket.on(CAPTAIN_SOCKET_EVENTS.ORDER_UPDATED, onOrderUpdated);

  return () => {
    socket.off(CAPTAIN_SOCKET_EVENTS.ASSIGNMENT, onAssignment);
    socket.off(CAPTAIN_SOCKET_EVENTS.ASSIGNMENT_ENDED, onAssignmentEnded);
    socket.off(CAPTAIN_SOCKET_EVENTS.ORDER_UPDATED, onOrderUpdated);
  };
}
