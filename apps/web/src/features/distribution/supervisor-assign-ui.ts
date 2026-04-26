import type { CaptainListItem, OrderListItem } from "@/types/api";

/**
 * Roster for manual assign: only captains under the same store supervisor (SUPERVISOR_LINKED).
 * PUBLIC or missing store supervisor: full pool.
 */
export function filterCaptainsForManualAssign(order: OrderListItem, pool: CaptainListItem[]): CaptainListItem[] {
  const st = order.store;
  if (st.subscriptionType !== "SUPERVISOR_LINKED" || !st.supervisorUser) return pool;
  const sid = st.supervisorUser.id;
  return pool.filter((c) => c.supervisorUser?.id === sid);
}

/**
 * Drag/drop: block only when the captain is in the roster and clearly out of scope.
 * If missing from the current pool page, allow the attempt — server is authoritative.
 */
export function isCaptainRosterDropAllowed(
  order: OrderListItem,
  captainId: string,
  roster: CaptainListItem[],
): boolean {
  const st = order.store;
  if (st.subscriptionType !== "SUPERVISOR_LINKED" || !st.supervisorUser) return true;
  const row = roster.find((x) => x.id === captainId);
  if (!row) return true;
  return row.supervisorUser?.id === st.supervisorUser.id;
}
