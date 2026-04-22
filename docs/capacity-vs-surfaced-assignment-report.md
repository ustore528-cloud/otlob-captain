# Capacity vs Surfaced Assignment Report

**Date:** 2026-04-19  
**Scope:** Operational limits on how many orders a captain may hold vs what `GET /api/v1/mobile/captain/me/assignment` returns.

---

## 1. Files reviewed (exact paths)

| Path | What was verified |
|------|-------------------|
| `apps/api/src/services/distribution/constants.ts` | `AUTO_CAPTAIN_MAX_ACTIVE_ORDERS = 2`; comment that manual assignment is not limited by this constant. |
| `apps/api/src/services/distribution/distribution-engine.ts` | `offerNextAutoCaptainTx`: capacity `groupBy` + filter; `assignManualOverride` / `reassign`: no capacity check. |
| `apps/api/src/services/distribution/eligibility.ts` | Auto pool eligibility vs manual override eligibility (no load counting). |
| `apps/api/src/services/distribution/index.ts` | Re-exports `AUTO_CAPTAIN_MAX_ACTIVE_ORDERS`; service wrappers for manual/auto flows. |
| `apps/api/src/services/captain-mobile.service.ts` | `getCurrentAssignment`: `findFirst` OFFER branch, then `findFirst` ACTIVE with `orderBy: { updatedAt: "desc" }`. |
| `apps/api/src/services/orders.service.ts` | `acceptByCaptain` / `rejectByCaptain`: per-`orderId`; no concurrent-order cap at accept time. |
| `apps/api/src/repositories/order.repository.ts` | `listForCaptain`: broad OR (assigned or any assignment log) — history is not singular. |
| `apps/api/src/services/tracking.service.ts` | `activeCaptainsMap`: aggregates `waitingOffers` / `activeOrders` per captain from multiple orders. |
| `apps/api/src/controllers/mobile-captain.controller.ts` | `workStatus` is global quick alert — not a per-captain concurrent-order count. |

Captain mobile was not re-audited line-by-line for this report; the singular contract is already documented on the client. User-facing consequences below reference API behavior and typical app usage of `/me/assignment`.

---

## 2. Confirmed behavior (code-backed only)

### 2.1 `AUTO_CAPTAIN_MAX_ACTIVE_ORDERS` (value: **2**)

- **Defined in** `constants.ts` as the automatic-distribution load limit per captain (“حد الحمل التلقائي”).
- **Applied only in** `DistributionEngine.offerNextAutoCaptainTx` when choosing the next captain for an **AUTO** offer.
- **How load is counted:** `order.groupBy(assignedCaptainId)` where `distributionMode === AUTO` and `status` ∈ `ASSIGNED`, `ACCEPTED`, `PICKED_UP`, `IN_TRANSIT`. Captains with load **≥ 2** are excluded from receiving a **new AUTO** offer.
- **Not applied to:** manual assign (`assignManualOverride`), reassign (`reassign`), or captain **accept** / **reject** flows (`orders.service.ts`).

### 2.2 Manual / override distribution

- `assignManualOverride` and `reassign` require `captainEligibleForManualOverride` only (active captain + active user); **no** check against `AUTO_CAPTAIN_MAX_ACTIVE_ORDERS` or any other concurrent-order count.

### 2.3 `GET .../me/assignment` (singular snapshot)

- **OFFER path:** `orderAssignmentLog.findFirst` for this captain with `PENDING` and non-expired offer, `orderBy` soonest `expiredAt` then `assignedAt` desc — **one** row.
- **Else ACTIVE path:** `order.findFirst` for this captain with `ACCEPTED` | `PICKED_UP` | `IN_TRANSIT`, `orderBy: { updatedAt: "desc" }` — **one** order (most recently updated).
- Therefore, if **two or more** orders qualify for ACTIVE simultaneously, **only one** appears in this response. If an OFFER exists, it takes precedence over ACTIVE in the flow (pending branch runs first).

### 2.4 Can a captain operationally hold more than one in-flight / assignable order while `/me/assignment` shows one?

**Yes, this is possible in the data model and flows:**

1. **AUTO path:** Capacity **2** means the system can place **up to two** qualifying AUTO orders on the same captain before refusing further AUTO offers. The mobile endpoint still returns **one** snapshot (see 2.3).
2. **Manual / reassign path:** There is **no** engine-level cap; operations can assign additional orders regardless of existing load.
3. **Dispatcher map:** `tracking.service.ts` `activeCaptainsMap` explicitly counts multiple `ASSIGNED` / in-progress rows per captain — the backend **already represents** multi-order load for ops/analytics.

---

## 3. User-facing consequences of the mismatch

(Only where the app relies on the singular snapshot for “current live” UX; other APIs e.g. order-by-id or history may still show other orders.)

| Area | Consequence |
|------|-------------|
| Live / assignment tab | Shows **at most one** OFFER or one ACTIVE order; additional concurrent orders are **not** listed there. |
| Which order “wins” | **OFFER** beats ACTIVE when both exist; among ACTIVE-only, **latest `updatedAt`** wins — the others have **no** representation on this endpoint. |
| Push / socket | Events are often **per `orderId`**; the captain may receive signals about order B while the live screen still reflects order A (or an OFFER on a different order). |
| Order history / detail | History listing and `getOrderById` can still expose other orders; behavior depends on navigation and product flows — not derived from `/me/assignment` alone. |
| Dispatcher vs captain | Dashboard can show **multiple** live/offer counts per captain; captain mobile “live” does not mirror that cardinality. |

---

## 4. Classification

| Option | Assessment |
|--------|------------|
| **Intended product behavior** | **Partially:** A **singular** mobile contract is **intentional** (documented in code). Operational **multi-order** capacity (especially AUTO **2** and manual **uncapped**) is **not** fully reflected in that contract — so “everything is by design” only holds if product explicitly accepts **hidden** concurrent orders on the live surface. |
| **Acceptable temporary limitation** | **Only if** operations **rarely** create true concurrency (e.g. second order almost never while first is active), or captains are trained to use **history/detail** for overflow. Not enforced by code. |
| **Backend / mobile product mismatch** | **Yes, when concurrency occurs:** Backend rules **allow** (and for AUTO, **plan for**) up to **two** AUTO-slot orders; manual flows allow **more**; mobile live UX **surfaces one**. That is a **capability vs presentation** gap, not a bug in `findFirst` itself. |

---

## 5. Recommended next decision

Pick **one** explicit product stance and align implementation (or ops) to it:

1. **Strict single active surface:** Enforce at API (or ops policy only) that a captain never has more than one qualifying OFFER+ACTIVE combination that matters — e.g. reject manual assign when above threshold, or align AUTO cap to **1** if the app must never hide a second order.  
2. **Multi-order live UX:** New or extended contract (list or prioritized array), DTOs, and captain UI — **required** if concurrency is normal.  
3. **Keep singular UI but add safety nets:** e.g. secondary-order banner, unread count, or deep link from notification — **without** changing the core list contract.

Until one of these is chosen, treat **stacked concurrent orders** as an **operational risk** (confusion, wrong-ticket actions) rather than as fully supported by the captain “live” experience.

---

## 6. Open items (not verified in this pass)

- Real-world frequency of captains with **two** AUTO-slot orders vs **manual** stacking (would need metrics or DB sampling).
- Whether captain mobile order history filters or labels “other active” orders for quick access (UI review outside API audit).
