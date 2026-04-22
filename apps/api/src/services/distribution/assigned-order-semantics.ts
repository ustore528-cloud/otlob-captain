/**
 * Unified semantics for `OrderStatus.ASSIGNED` across automatic distribution and captain mobile.
 *
 * **Automatic distribution blocking:** `ASSIGNED` is included in `CAPTAIN_ACTIVE_WORKING_ORDER_STATUSES`.
 * Any captain with an `ASSIGNED` order counts as busy for default single-order auto distribution
 * (same workload family as `ACCEPTED` / `PICKED_UP` / `IN_TRANSIT` for capacity checks).
 *
 * **Captain mobile rendering:** While the order is still a pending offer (`orderAssignmentLog` PENDING),
 * DB status remains `ASSIGNED` but `/me/assignment` exposes `state: "OFFER"` — the app shows the offer
 * card (accept/reject), not the post-acceptance “ACTIVE work” card.
 *
 * **ACTIVE current work:** `state: "ACTIVE"` and “current work” progression start after acceptance,
 * i.e. from `ACCEPTED` upward (`CAPTAIN_CURRENT_WORKING_STATUSES` in `captain-mobile.service` — `ASSIGNED`
 * is intentionally excluded there because pending offers are served via the OFFER branch above).
 *
 * @see CAPTAIN_ACTIVE_WORKING_ORDER_STATUSES in `./eligibility.js`
 * @see `CAPTAIN_CURRENT_WORKING_STATUSES` in `../captain-mobile.service.js`
 */
export const ASSIGNED_ORDER_SEMANTICS = "see JSDoc above" as const;
