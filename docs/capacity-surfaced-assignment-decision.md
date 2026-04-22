# Decision: Capacity vs Surfaced Live Assignment

**Status:** Accepted  
**Date:** 2026-04-19  
**Context:** Investigation in [`capacity-vs-surfaced-assignment-report.md`](./capacity-vs-surfaced-assignment-report.md) confirmed that operations may assign more than one order per captain while `GET /api/v1/mobile/captain/me/assignment` returns one snapshot.

---

## Recommended option: **C â€” Singular surfaced UI with explicit safety nets**

---

## Reasons for choosing Option C

1. **Contract already decided:** The live assignment API is intentionally **singular** (NONE | one OFFER | one ACTIVE). Option C preserves that contract and the mental model of **one primary card** on the live screen, avoiding a full replatform of polling, DTOs, and workbench state.

2. **Backend reality is intentional elsewhere:** `AUTO_CAPTAIN_MAX_ACTIVE_ORDERS = 2` and **manual/reassign without a load cap** exist to support dispatch and throughput. **Option A** would require reversing or constraining those rules (or accepting stricter ops), which is a large business tradeoff unrelated to â€œmobile UX clarityâ€‌ alone.

3. **Option B is a program, not a tweak:** A true multi-order live experience needs a **new** list contract, conflict rules (OFFER vs multiple ACTIVE), notification routing, and a redesigned workbench. That remains valid as a **future** initiative if product prioritizes multi-tasking captains; it is not required to **resolve the mismatch** responsibly.

4. **Option C addresses the actual risk:** The gap hurts when captains **do not know** another order is active. Safety nets (visibility + navigation + optional friction) fix **awareness and wrong-order actions** without pretending the backend is single-order-only.

---

## Engineering consequences (Option C)

See also: [Overflow Behavior Spec](./overflow-behavior-spec.md)

| Area | Consequence |
|------|-------------|
| **API** | Keep **`/me/assignment` singular** as the primary snapshot. Add **one complementary read** (new endpoint or query params on an existing resource) that returns **overflow summary** only when needed: e.g. `hiddenActiveCount`, `secondaryOrderIds[]`, or `hasAdditionalActiveOffers` â€” minimal shape, stable for caching. |
| **Backend rules** | **No requirement** to lower `AUTO_CAPTAIN_MAX_ACTIVE_ORDERS` to 1 or to add a hard global cap on manual assign for Option C. Optional **product policy** later: dispatcher warnings when assigning above N concurrent orders. |
| **DTOs & shared types** | Extend captain mobile DTOs for the **overflow** payload; keep `CurrentAssignmentResponse` unchanged for the main snapshot. |
| **Hooks** | Compose `useCaptainAssignment` (unchanged key semantics) with a lightweight **`useCaptainAssignmentOverflow`** (or merge into one query if batched server-side). |
| **UI** | Live tab remains **one primary card**; add **banner, badge, or sheet** when overflow &gt; 0 with tap-through to history/detail or a small â€œother active ordersâ€‌ list screen. |
| **Notifications / deep links** | Ensure **order-scoped** actions always resolve by `orderId`; overflow UI should not depend solely on `/me/assignment` for routing. |
| **Testing** | E2E or integration cases: **two concurrent ACTIVE** (or OFFER + ACTIVE) â€” primary snapshot + overflow indicator + navigation to secondary. |

---

## User-facing consequences (Option C)

| Stakeholder | Consequence |
|-------------|-------------|
| **Captain** | **One** primary live order as today, plus **clear notice** when another assignable or in-flight order exists (â€œظ„ط¯ظٹظƒ ط·ظ„ط¨ ط¥ط¶ط§ظپظٹâ€¦â€‌ / equivalent). Reduced risk of acting on the wrong ticket; optional list of non-primary actives. |
| **Dispatcher / ops** | **No forced change** to assignment rules on day one. May add **soft warnings** in dashboard later if policy tightens. |
| **Support** | Fewer â€œapp didnâ€™t show my other orderâ€‌ reports if overflow is visible and tappable. |

---

## Options not selected (summary)

| Option | Why not now |
|--------|-------------|
| **A â€” Strict single-active** | Collides with existing **AUTO capacity 2** and **unlimited manual** paths; requires coordinated policy and backend enforcement before mobile can rely on â€œnever hidden.â€‌ |
| **B â€” Multi-order live** | Correct if multi-tasking is a **top product bet**; scope is **large** (API + app + QA). Defer until explicitly prioritized; Option C does not block migrating to B later. |

---

## Follow-up

- Product: confirm **copy** and **thresholds** for when to show overflow (any second qualifying order vs only ACTIVE, etc.).
- Engineering: spike **minimal overflow payload** + one screen or banner path before expanding.

