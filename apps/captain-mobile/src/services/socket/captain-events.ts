/** @see docs/mobile-captain-api.md §7 */

export const CAPTAIN_SOCKET_EVENTS = {
  assignment: "captain:assignment",
  assignmentEnded: "captain:assignment:ended",
  orderUpdated: "captain:order:updated",
} as const;
