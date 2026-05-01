import type { ActiveMapCaptain, CaptainListItem, OrderListItem } from "@/types/api";

/** Align with API `PLATFORM_SUPER_ADMIN_DISPATCH_MAX_DISTANCE_KM` default (frontend UX hint only). */
export const PLATFORM_ASSIGN_NEARBY_MAX_KM = 75;

export type ManualAssignCaptainRow = CaptainListItem & {
  /** i18n keys — resolved in modal */
  rosterLabelKeys?: string[];
  /** Wrong-company rows (shown disabled for SUPER_ADMIN roster context). */
  selectionDisabled?: boolean;
};

export function isDashboardPlatformOrder(order: Pick<OrderListItem, "isPlatformOrder" | "createdByRole">): boolean {
  if (order.isPlatformOrder === true) return true;
  if (order.isPlatformOrder === false) return false;
  return order.createdByRole === "SUPER_ADMIN";
}

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function captainCoordsFromActiveMap(
  captains: ActiveMapCaptain[] | null | undefined,
): Map<string, { lat: number; lng: number }> {
  const m = new Map<string, { lat: number; lng: number }>();
  for (const c of captains ?? []) {
    const loc = c.lastLocation;
    if (loc) m.set(c.id, { lat: loc.latitude, lng: loc.longitude });
  }
  return m;
}

function applySupervisorLinkedFilter(order: OrderListItem, pool: CaptainListItem[]): CaptainListItem[] {
  const st = order.store;
  if (st.subscriptionType !== "SUPERVISOR_LINKED" || !st.supervisorUser) return [...pool];
  const sid = st.supervisorUser.id;
  return pool.filter((c) => c.supervisorUser?.id === sid);
}

function captainNameSortKey(c: CaptainListItem): string {
  return `${c.user.fullName} ${c.user.phone}`.toLowerCase();
}

/**
 * UI-only roster for manual assign / reassign. Server `canAssignCaptainToOrder` remains authoritative.
 */
export function buildManualAssignmentRoster(
  order: OrderListItem,
  pool: CaptainListItem[],
  activeMapCaptains?: ActiveMapCaptain[] | null,
): ManualAssignCaptainRow[] {
  const platform = isDashboardPlatformOrder(order);
  const supervisorPool = applySupervisorLinkedFilter(order, pool);
  const locMap = captainCoordsFromActiveMap(activeMapCaptains);
  const orderCompanyId = order.companyId?.trim() ?? "";
  const pickup =
    order.pickupLat != null && order.pickupLng != null
      ? { lat: order.pickupLat, lng: order.pickupLng }
      : null;

  const sameCompany = orderCompanyId
    ? supervisorPool.filter((c) => c.companyId === orderCompanyId)
    : [...supervisorPool];
  const otherCompany = orderCompanyId
    ? supervisorPool.filter((c) => c.companyId !== orderCompanyId)
    : [];

  const branchScoped = platform
    ? sameCompany
    : sameCompany.filter((c) => !order.branchId || c.branchId === order.branchId);

  const distanceFor = (captainId: string): number | null => {
    if (!pickup) return null;
    const p = locMap.get(captainId);
    return p ? haversineMeters(pickup, p) : null;
  };

  const enrich = (c: CaptainListItem, opts: { selectionDisabled?: boolean }): ManualAssignCaptainRow => {
    const keys: string[] = [];
    const orderZone = order.zoneId ?? null;
    const capZone = c.zoneId ?? null;
    if (orderZone && capZone && orderZone !== capZone) {
      keys.push("manualAssign.roster.zoneMismatch");
    }

    if (platform && pickup) {
      const d = distanceFor(c.id);
      if (d != null) {
        const km = d / 1000;
        if (km <= PLATFORM_ASSIGN_NEARBY_MAX_KM) keys.push("manualAssign.roster.nearPickup");
        else keys.push("manualAssign.roster.farPickup");
      } else {
        keys.push("manualAssign.roster.captainLocationUnknown");
      }
    }

    return {
      ...c,
      ...(keys.length > 0 ? { rosterLabelKeys: keys } : {}),
      ...(opts.selectionDisabled ? { selectionDisabled: true } : {}),
    };
  };

  const primary: ManualAssignCaptainRow[] = branchScoped.map((c) => enrich(c, {}));

  if (pickup && platform) {
    primary.sort((a, b) => {
      const da = distanceFor(a.id);
      const db = distanceFor(b.id);
      if (da != null && db != null) return da - db;
      if (da != null) return -1;
      if (db != null) return 1;
      return captainNameSortKey(a).localeCompare(captainNameSortKey(b));
    });
  } else if (pickup && !platform) {
    primary.sort((a, b) => {
      const da = distanceFor(a.id);
      const db = distanceFor(b.id);
      if (da != null && db != null) return da - db;
      if (da != null) return -1;
      if (db != null) return 1;
      return captainNameSortKey(a).localeCompare(captainNameSortKey(b));
    });
  } else {
    primary.sort((a, b) => captainNameSortKey(a).localeCompare(captainNameSortKey(b)));
  }

  const tail: ManualAssignCaptainRow[] = otherCompany.map((c) => {
    const base = enrich(c, { selectionDisabled: true });
    return {
      ...base,
      rosterLabelKeys: [...new Set(["manualAssign.roster.otherCompany", ...(base.rosterLabelKeys ?? [])])],
    };
  });

  return [...primary, ...tail];
}
