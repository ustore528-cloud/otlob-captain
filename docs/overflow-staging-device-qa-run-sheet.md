# Overflow — Staging / Device QA Run Sheet

**App:** captain mobile (`apps/captain-mobile`)  
**Endpoints:** `GET /api/v1/mobile/captain/me/assignment`, `GET /api/v1/mobile/captain/me/assignment/overflow`  
**Primary UI:** tab **الطلب الحالي** (Orders live) — overflow banner sits **above** the primary card.

**How to read API on device (pick one):**

- Proxy (Charles / mitmproxy): capture JSON for both paths after each step.
- Or `adb logcat` if the app logs responses (optional).
- Or temporary debug log in dev build (not required for QA if proxy is used).

**Overflow UI elements:**

- **Success path:** amber-accent banner with count + tappable rows (order number + عرض/نشط).
- **Failure path:** compact amber warning (“تعذّر التحقق من الطلبات الإضافية…”) + **إعادة المحاولة**.
- **Primary card:** unchanged by overflow failure (accept/reject/status still work).

---

## Scenario 1: primary OFFER only

### Objective

- Validate singular primary OFFER with **no** secondary assignable/in-flight orders in overflow.

### Preconditions

- Staging API reachable from device (`EXPO_PUBLIC_API_URL` correct for build).
- Captain logged in; availability **AVAILABLE** (or whatever your dispatch pool requires).
- Dispatcher (or script): **one** order for this captain in `ASSIGNED` with a **PENDING** assignment log not expired; **no** other orders for this captain in `ACCEPTED` / `PICKED_UP` / `IN_TRANSIT`.

### Device actions

1. Cold start app → login if needed.
2. Open tab **الطلب الحالي**.
3. Wait up to ~15 s (poll) or pull-to-refresh once.
4. Observe primary card: offer countdown / accept / reject.

### Expected API state

- **`/me/assignment`:** `{ state: "OFFER", order: { … } }` (single order).
- **`/me/assignment/overflow`:** `{ primaryOrderId: <same as offer order id>, items: [] }`.

### Expected UI state

- **Primary card:** OFFER with actions.
- **Overflow banner:** **hidden** (no extra rows).
- **Warning:** **hidden**.
- **Count:** no overflow count line.

### Expected sync behavior

- Pull-to-refresh: both endpoints refetch; overflow stays empty if preconditions hold.
- Focus away and back: refetch; same state.

### Evidence to capture

- Screenshot: Orders live with OFFER, **no** overflow banner.
- API snapshots for both GETs (redact tokens).
- Timestamp.

### Pass / Fail criteria

- **Pass:** OFFER on primary; overflow `items` length `0`; no warning; accept/reject usable.
- **Fail:** overflow shows rows while only one qualifying order exists; or primary not OFFER.

---

## Scenario 2: primary ACTIVE only

### Objective

- Validate singular **ACTIVE** primary with **no** pending offers and **no** overflow.

### Preconditions

- Captain has **exactly one** order in `ACCEPTED` | `PICKED_UP` | `IN_TRANSIT` assigned to them.
- **No** pending `PENDING` assignment logs for this captain on any `ASSIGNED` order (or none that pass the non-expired filter).

### Device actions

1. Open **الطلب الحالي**.
2. Wait / pull-to-refresh.
3. Use primary actions only if needed to confirm card is delivery (advance status is optional).

### Expected API state

- **`/me/assignment`:** `{ state: "ACTIVE", order: { … } }`.
- **`/me/assignment/overflow`:** `{ primaryOrderId: <that order id>, items: [] }`.

### Expected UI state

- **Primary card:** active delivery card + advance actions as per app rules.
- **Overflow banner:** **hidden**.
- **Warning:** **hidden**.

### Expected sync behavior

- Refresh/focus: still single ACTIVE, overflow empty.

### Evidence to capture

- Screenshot: ACTIVE primary, no overflow.
- API snapshots.

### Pass / Fail criteria

- **Pass:** ACTIVE primary; overflow empty; no warning.
- **Fail:** OFFER primary while preconditions say no offers; or phantom overflow rows.

---

## Scenario 3: primary ACTIVE + one overflow ACTIVE

### Objective

- Validate **two concurrent in-flight** orders: newest `updatedAt` is primary ACTIVE; the other appears as **one** overflow row (`kind: "ACTIVE"`).

### Preconditions

- Same captain: **two** orders in `ACCEPTED` | `PICKED_UP` | `IN_TRANSIT`.
- **No** qualifying pending offers for this captain (otherwise primary becomes OFFER — see Scenario 1/4 note).
- Data: order **B** has **newer** `updatedAt` than order **A** (dispatcher updates or status bump B last).

### Device actions

1. Open **الطلب الحالي**.
2. Pull-to-refresh.
3. Read primary order number vs overflow row order number.

### Expected API state

- **`/me/assignment`:** `state: "ACTIVE"`, `order.id` = **B** (newest `updatedAt`).
- **`/me/assignment/overflow`:** `primaryOrderId` = B; `items` length **1**; item `kind: "ACTIVE"`, `orderId` = **A**.

### Expected UI state

- **Primary card:** order **B**.
- **Banner:** visible; count **1** (or Arabic copy for one extra order).
- **One** row; badge **نشط**; tap navigates to order A detail.

### Expected sync behavior

- After pull-to-refresh: same pairing unless `updatedAt` changes.

### Evidence to capture

- Screenshot: primary B + overflow row A.
- API snapshots showing B primary, A in overflow.

### Pass / Fail criteria

- **Pass:** exactly one overflow ACTIVE row; primary matches newest-updated rule; navigation opens A.
- **Fail:** wrong order on primary; duplicate primary id in overflow; count wrong.

---

## Scenario 4: primary ACTIVE + one overflow OFFER

### Objective

- **Contract note:** With consistent data, **primary cannot be ACTIVE while any qualifying OFFER exists** — `getCurrentAssignment` always returns **OFFER** first. Therefore the literal title state is **not reachable** as a steady snapshot.
- This scenario validates the **reachable analogue**: **primary OFFER** + **overflow ACTIVE** (in-flight order hidden behind the offer card).

### Preconditions

- Captain has order **A** in `ACCEPTED` | `PICKED_UP` | `IN_TRANSIT`.
- Dispatcher assigns **new** order **B** to same captain: `ASSIGNED` + **PENDING** log, not expired.

### Device actions

1. Ensure A is active, then create offer B from dispatcher.
2. Open **الطلب الحالي**; refresh.
3. Confirm primary shows **B** (offer); confirm overflow lists **A** as ACTIVE.

### Expected API state

- **`/me/assignment`:** `state: "OFFER"`, order **B**.
- **`/me/assignment/overflow`:** `primaryOrderId` = B; `items` includes **A** with `kind: "ACTIVE"`.

### Expected UI state

- **Primary card:** OFFER for B (accept/reject).
- **Banner:** shows **A** as overflow row (**نشط**).

### Expected sync behavior

- After accept on B: primary may become ACTIVE on B; overflow may show A if still qualifying — document actual API after accept.

### Evidence to capture

- Screenshot: OFFER primary B + overflow ACTIVE A.
- API snapshots; note in notes: “Scenario 4 title not steady-state; tested OFFER+ACTIVE overflow analogue.”

### Pass / Fail criteria

- **Pass:** OFFER primary when offer exists; overflow row for concurrent ACTIVE A; no false “no overflow” if A exists.
- **Fail:** primary stays ACTIVE while B offer is pending and valid.

---

## Scenario 5: multiple overflow items

### Objective

- Validate **more than one** overflow row (mix of secondary OFFERs and/or ACTIVEs), correct count, stable ordering (offers segment then actives per implementation).

### Preconditions

- Captain has:
  - Primary resolved per rules (usually **OFFER** if any pending offer exists; else newest ACTIVE).
  - At least **two** orders in overflow set (e.g. two extra ACTIVEs with no offers, or one extra OFFER + one extra ACTIVE — depends on setup).

**Example setup (no pending offers):** three ACTIVE-family orders; newest = primary, other two = overflow (count 2).

### Device actions

1. Open **الطلب الحالي**; refresh.
2. Count visible overflow rows; compare to API `items.length`.

### Expected API state

- **`/me/assignment`:** single primary snapshot.
- **`/me/assignment/overflow`:** `items.length` ≥ 2; no duplicate `orderId`; `primaryOrderId` not in `items`.

### Expected UI state

- Banner count matches `items.length`.
- Each row tappable; badges عرض/نشط match `kind`.

### Expected sync behavior

- Refresh updates list after dispatcher changes.

### Evidence to capture

- Screenshot full banner with all rows.
- API JSON for overflow.

### Pass / Fail criteria

- **Pass:** count matches; primary never duplicated in rows; navigation works per row.
- **Fail:** missing rows; wrong count string; duplicate primary in list.

---

## Scenario 6: overflow disappears after accept / reject / expiry / status transitions

### Objective

- After actions that remove secondary qualifiers, overflow **empties** or **updates** without stale phantom rows.

### Preconditions

- Start from Scenario 3 or 5 (overflow non-empty).

### Device actions

1. **Accept/reject** (if primary is OFFER): perform action; wait ~15 s or refresh.
2. **Expiry:** let offer expire without acting; wait until primary clears offer (poll + distribution); refresh overflow.
3. **Status:** advance primary ACTIVE order through pickup → in-transit → delivered until it leaves ACTIVE family; refresh after each if testing stepwise.

### Expected API state

- Overflow `items` only contains orders still `ASSIGNED`+PENDING (offer path) or `ACCEPTED|PICKED_UP|IN_TRANSIT` (active path), excluding primary.
- When no secondary remain: `items: []`.

### Expected UI state

- Banner **hidden** when `items` empty and no error.
- Warning only if overflow **fetch** fails (not because items empty).

### Expected sync behavior

- Mutations invalidate assignment + overflow queries; UI updates after refetch.

### Evidence to capture

- Before/after API snapshots; screenshots.

### Pass / Fail criteria

- **Pass:** overflow list matches server after each transition; empty when no secondary orders.
- **Fail:** stale overflow row after order no longer qualifies.

---

## Scenario 7: overflow fetch failure on unstable network

### Objective

- When **only** overflow GET fails, UI shows **warning**, not empty success.

### Preconditions

- Working session; primary assignment can still load.

### Device actions

1. Open **الطلب الحالي** with stable network; wait until primary loads.
2. Enable **airplane mode** (or block only overflow via proxy if you can) **after** primary loaded.
3. Trigger overflow refetch: pull-to-refresh **or** wait for next poll (~12 s) **or** switch away and back to tab.
4. If overflow fails and assignment succeeds: observe warning strip.

### Expected API state

- Assignment may still 200 from cache or succeed when network returns; overflow request fails (4xx/5xx/timeout).

### Expected UI state

- **Primary card:** still interactive (accept/reject/status per state).
- **Warning:** visible (“تعذّر التحقق من الطلبات الإضافية…”).
- **Banner list:** may be absent if no cached overflow data.

### Expected sync behavior

- Warning stays until overflow refetch succeeds.

### Evidence to capture

- Screenshot of warning + primary card.
- Proxy/log showing failed overflow GET.

### Pass / Fail criteria

- **Pass:** warning visible on overflow failure; primary still usable; **no** silent empty overflow implying “zero secondary.”
- **Fail:** no warning when overflow fails with no cache.

---

## Scenario 8: retry after overflow failure

### Objective

- Tap **إعادة المحاولة** refetches overflow; warning clears on success.

### Preconditions

- Scenario 7 state (overflow error visible).

### Device actions

1. Restore network (disable airplane mode).
2. Tap **إعادة المحاولة** on warning.
3. Wait for request to complete.

### Expected API state

- Overflow GET returns 200 with valid JSON.

### Expected UI state

- Warning **disappears** if `isError` clears.
- If `items.length > 0`, success banner rows appear.

### Expected sync behavior

- No need to kill app.

### Evidence to capture

- Screen recording: warning → tap retry → success.
- API snapshot after retry.

### Pass / Fail criteria

- **Pass:** retry triggers refetch; warning clears on success; overflow list matches API.
- **Fail:** retry no-op; warning stuck after successful 200.

---

## Scenario 9: stale cached overflow + current fetch error

### Objective

- When TanStack Query has **cached overflow data** and a **new** fetch fails, user still sees **warning** (not a silent OK).

### Preconditions

- Stable network first: open screen so overflow succeeds with at least one item (cache populated).
2. Then break network (airplane) and trigger refetch (pull-to-refresh).

### Device actions

1. Load overflow success with `items.length >= 1`.
2. Airplane on; pull-to-refresh.
3. Observe warning + whether old rows still show (cache).

### Expected API state

- Latest overflow GET fails.

### Expected UI state

- **Warning:** visible.
- **Rows:** may still show cached items; copy should not read as “authoritative fresh list” — warning communicates uncertainty.

### Expected sync behavior

- Retry after network restore clears warning and refreshes data.

### Evidence to capture

- Screenshot: warning + cached rows (if shown).

### Pass / Fail criteria

- **Pass:** warning visible on error even if cache exists; primary still usable.
- **Fail:** error state looks identical to “no overflow” (no warning).

---

## Scenario 10: manual refresh and retry overlap

### Objective

- Pull-to-refresh and **إعادة المحاولة** do not break each other; no stuck loading on primary.

### Preconditions

- Overflow in error state (Scenario 7).

### Device actions

1. Pull-to-refresh (runs both assignment + overflow refetch).
2. Immediately tap **إعادة المحاولة**.
3. Repeat once.

### Expected UI state

- Primary **RefreshControl** may show refreshing; primary card still usable after refresh ends.
- No permanent spinner blocking actions.

### Expected sync behavior

- Queries settle; no duplicate mutations.

### Evidence to capture

- Short screen recording.

### Pass / Fail criteria

- **Pass:** no crash; no stuck UI; overflow eventually consistent.
- **Fail:** app freeze; duplicate errors; primary blocked.

---

## Scenario 11: rapid error / success oscillation

### Objective

- Flaky network does not leave warning permanently wrong; recovers when stable.

### Preconditions

- Toggle airplane or use proxy throttle intermittently.

### Device actions

1. Rapidly toggle airplane on/off every 3–5 s for ~30 s while staying on **الطلب الحالي**.
2. Observe warning flicker vs stable success.

### Expected UI state

- Warning may appear/disappear with failures/successes.
- Primary card remains usable throughout.

### Pass / Fail criteria

- **Pass:** no crash; when network stable, warning clears if overflow succeeds.
- **Fail:** crash; permanent warning after stable network without failed requests.

---

## Scenario 12: navigation from overflow rows to order detail

### Objective

- Each overflow row opens the correct order detail screen.

### Preconditions

- Overflow with ≥ 1 item (Scenario 3 or 5).

### Device actions

1. Tap overflow row for order **X**.
2. Verify detail shows order **X** (number, id in URL if visible).
3. Back navigates to **الطلب الحالي** without losing session.

### Expected API state

- `GET /mobile/captain/orders/:orderId` succeeds for captain (detail load).

### Expected UI state

- Order detail screen for correct order.
- No wrong-order detail.

### Pass / Fail criteria

- **Pass:** navigation matches `orderId` tapped.
- **Fail:** wrong order opens; crash on back.

---

# QA Execution Table

**Completed runs:** record results in [`overflow-staging-device-qa-execution-results.md`](./overflow-staging-device-qa-execution-results.md) (keep this table in sync or paste the same table there).

| Scenario | Tester | Device | Build | Pass/Fail | Notes | Evidence captured |
|----------|--------|--------|-------|-----------|-------|-------------------|
| 1 | | | | | | |
| 2 | | | | | | |
| 3 | | | | | | |
| 4 | | | | | | |
| 5 | | | | | | |
| 6 | | | | | | |
| 7 | | | | | | |
| 8 | | | | | | |
| 9 | | | | | | |
| 10 | | | | | | |
| 11 | | | | | | |
| 12 | | | | | | |

---

# Blocking Conditions

Execution is **invalid** or blocked if any of the following is missing:

- **Staging API** not reachable from device (wrong `EXPO_PUBLIC_API_URL`, firewall, DNS).
- **No captain credentials** or session cannot be established.
- **No dispatcher access** (or admin tools) to place orders in `ASSIGNED` / `ACCEPTED` / etc., so multi-order states cannot be created.
- **No network control** (airplane / proxy / throttling) for failure scenarios 7–11.
- **No capture path** for API payloads (proxy or logs) when disputes arise.

---

# Final Exit Criteria

Broader rollout is allowed only if **all** are true:

1. Scenarios **1–3, 5–6, 12** **Pass** on at least **one physical Android device** (emulator optional).
2. Scenario **4** **Pass** under the documented contract (OFFER primary + ACTIVE overflow analogue; primary ACTIVE + overflow OFFER not a steady state).
3. Scenarios **7–11** **Pass** for overflow **warning + retry** behavior without blocking primary actions.
4. **No** open **P1** bugs: wrong-order navigation, silent overflow failure without warning, primary duplicated in overflow list, crash on refresh/retry.

---

*Run sheet version: aligned with overflow implementation + warning UX in `AssignmentOverflowBanner` and `useCaptainAssignmentWorkbench`.*
