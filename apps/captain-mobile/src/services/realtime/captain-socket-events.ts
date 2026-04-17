/**
 * أسماء الأحداث — يجب أن تطابق `apps/api/src/realtime/captain-events.ts`
 * @see CAPTAIN_SOCKET_EVENTS في الخادم
 */
export const CAPTAIN_SOCKET_EVENTS = {
  ASSIGNMENT: "captain:assignment",
  ASSIGNMENT_ENDED: "captain:assignment:ended",
  ORDER_UPDATED: "captain:order:updated",
} as const;

export type CaptainSocketEventName = (typeof CAPTAIN_SOCKET_EVENTS)[keyof typeof CAPTAIN_SOCKET_EVENTS];
