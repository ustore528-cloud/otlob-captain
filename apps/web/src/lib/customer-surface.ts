/**
 * Paths for the anonymous customer send/track flow (no dashboard auth).
 */

export function matchesCustomerSurfacePath(pathname: string): boolean {
  const p = pathname.split("?")[0] ?? pathname;
  if (p === "/customer-order") return true;
  if (p === "/join-captain") return true;
  if (p.startsWith("/request/")) return true;
  if (p.startsWith("/public-request/")) return true;
  if (p.startsWith("/track/")) return true;
  return false;
}

/** Standalone (“Add to Home Screen”) detection — launcher / PWA chrome. */
export function isStandaloneDisplayMode(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)")?.matches) return true;
  const ios = Boolean((navigator as unknown as { standalone?: boolean }).standalone);
  return Boolean(ios);
}

/** Escape hatch: `/login?staff=1` for internal staff forced into a launcher shell. */
export function allowStaffStandaloneLoginBypass(search: string): boolean {
  try {
    return new URLSearchParams(search ?? "").has("staff");
  } catch {
    return false;
  }
}
