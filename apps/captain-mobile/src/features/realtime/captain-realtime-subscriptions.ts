import type { QueryClient } from "@tanstack/react-query";
import type { Socket } from "socket.io-client";
import { CAPTAIN_SOCKET_EVENTS } from "@/services/realtime/captain-socket-events";
import { invalidateCaptainRealtimeQueries } from "./invalidate-captain-realtime-queries";

/**
 * يربط أحداث الكابتن بـ React Query — يُستدعى `off` عند التنظيف أو إعادة الاتصال.
 */
export function attachCaptainRealtimeListeners(socket: Socket, queryClient: QueryClient): () => void {
  const flush = (reason: string) => {
    invalidateCaptainRealtimeQueries(queryClient, reason);
  };

  const onAssignment = () => flush("captain:assignment");
  const onAssignmentEnded = () => flush("captain:assignment:ended");
  const onOrderUpdated = () => flush("captain:order:updated");

  socket.on(CAPTAIN_SOCKET_EVENTS.ASSIGNMENT, onAssignment);
  socket.on(CAPTAIN_SOCKET_EVENTS.ASSIGNMENT_ENDED, onAssignmentEnded);
  socket.on(CAPTAIN_SOCKET_EVENTS.ORDER_UPDATED, onOrderUpdated);

  return () => {
    socket.off(CAPTAIN_SOCKET_EVENTS.ASSIGNMENT, onAssignment);
    socket.off(CAPTAIN_SOCKET_EVENTS.ASSIGNMENT_ENDED, onAssignmentEnded);
    socket.off(CAPTAIN_SOCKET_EVENTS.ORDER_UPDATED, onOrderUpdated);
  };
}
