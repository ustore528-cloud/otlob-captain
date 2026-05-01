import type { CaptainListItem, OrderListItem } from "@/types/api";
import { isDashboardPlatformOrder } from "@/features/distribution/manual-assign-roster";

/**
 * Roster for drag/drop: block only when the captain is in the roster and clearly out of scope.
 * If missing from the current pool page, allow the attempt — server is authoritative.
 */
export function isCaptainRosterDropAllowed(
  order: OrderListItem,
  captainId: string,
  roster: CaptainListItem[],
): boolean {
  const st = order.store;
  const row = roster.find((x) => x.id === captainId);

  const supervisorScoped =
    st.subscriptionType === "SUPERVISOR_LINKED" && st.supervisorUser && row
      ? row.supervisorUser?.id === st.supervisorUser.id
      : true;
  if (!supervisorScoped) return false;

  if (!order.companyId || !row) return true;
  if (row.companyId !== order.companyId) return false;
  if (isDashboardPlatformOrder(order)) return true;
  return !order.branchId || row.branchId === order.branchId;
}
