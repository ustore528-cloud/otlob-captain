# Verification: 30-second offer / confirmation cycle

Scope: timing source of truth, dispatcher panel vs captain mobile, real-world expiry behavior, and one safe alignment fix.

---

## A. Source of Truth

### What timestamp is authoritative

- **`OrderAssignmentLog.expiredAt`** (DB) is the canonical deadline for a pending offer.
- It is created at offer time as **`Date.now() + DISTRIBUTION_TIMEOUT_SECONDS * 1000`** (`expiredAtFromNow()` in `apps/api/src/services/distribution/distribution-engine.ts`).
- **`DISTRIBUTION_TIMEOUT_SECONDS`** comes from env (`apps/api/src/config/env.ts`, default **30**) and is re-exported as `DISTRIBUTION_TIMEOUT_SECONDS` in `apps/api/src/services/distribution/constants.ts`.

### Where it is created

| Path | Code | Notes |
|------|------|--------|
| AUTO round-robin offer | `offerNextAutoCaptainTx` | New log with `expiredAt: offerExpiresAt` |
| Manual assign / drag-drop | `assignManualOverride` | Same `expiredAtFromNow()` |
| Reassign | `reassign` | Same `expiredAtFromNow()` |

### Where it is consumed

| Consumer | Behavior |
|----------|----------|
| **Backend expiry worker** | `DistributionEngine.processDueTimeouts()` selects `responseStatus: PENDING` and `expiredAt <= now`, marks `EXPIRED`, then AUTO re-offers or releases order (`distribution-engine.ts`). Invoked on **`setInterval(..., env.DISTRIBUTION_POLL_MS)`** in `apps/api/src/server.ts` (default **2000 ms**). |
| **Accept / reject API** | `orders.service.ts` — `acceptByCaptain` / `rejectByCaptain` reject with `OFFER_EXPIRED` if `log.expiredAt.getTime() <= Date.now()` (immediate wall-clock check, no poll delay). |
| **Captain mobile “current assignment”** | `captainMobileService.getCurrentAssignment` returns `log.expiresAt` as ISO from `pendingLog.expiredAt` plus static `timeoutSeconds: DISTRIBUTION_TIMEOUT_SECONDS`. |
| **Dispatcher map / quick panel** | `trackingService.activeCaptainsMap()` sets `assignmentOfferExpiresAt` to the **minimum** `expiredAt` among all `PENDING` logs with non-null `expiredAt` per captain. UI uses `assignmentOfferSecondsLeft(iso)` in `apps/web/src/features/distribution/captain-map-visual.ts`: `Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 1000))`. |

### `assignedAt` / `createdAt`

- **`assignedAt`** on the log is set by Prisma default (creation time of the row); it is used for ordering and history, not for the 30s window.
- The **30s window** is entirely **`expiredAt - assignedAt` ≈ `DISTRIBUTION_TIMEOUT_SECONDS`** (modulo ms skew at insert).

---

## B. Panel vs Mobile Comparison

### Same underlying field

- Both panel countdown (when shown) and mobile OFFER payload ultimately use **`OrderAssignmentLog.expiredAt`** serialized as ISO UTC. There is no separate “mobile timer” stored on the device for the deadline.

### Different presentation (not the same UX)

| Aspect | Dispatcher panel | Captain mobile |
|--------|-------------------|----------------|
| **What you see** | Live **seconds remaining** on the map marker (`⏱ N ث`) updated every **1s** locally (`distribution-map.tsx` + `countdownTick`), while `assignmentOfferExpiresAt` is refetched on the distribution page every **4s** (`distributionPollMs = 4000`). | Hint text: static **`timeoutSeconds`** from API (same env-backed constant) and **wall-clock** expiry via `formatLastSeenAr(expiresAt)` — **no** per-second ticker. |
| **Which offer if multiple pending** | **Earliest** `expiredAt` among pending logs (`tracking.service.ts`). | After fix: **earliest** `expiredAt` among qualifying logs (`getCurrentAssignment` `orderBy: expiredAt asc, assignedAt desc`). Before fix: **latest** `assignedAt`, which could disagree with the map in edge cases. |

### Timezone / rounding

- **Timezone:** ISO strings are UTC; both clients parse with `new Date(iso)` — no extra offset logic.
- **Rounding:** Panel uses **`Math.ceil`** for whole seconds (`captain-map-visual.ts`). That can show **one second higher** than a strict floor during partial seconds. Mobile does not show an integer second countdown, so there is no digit-to-digit match.

### Polling / sockets

- **Panel:** Map data refreshes every **4s**; the countdown still ticks every second using **cached** `assignmentOfferExpiresAt` until the next refetch — usually negligible; at worst the displayed seconds jump when the server timestamp updates.
- **Mobile:** Assignment query refetches every **12s** by default (`use-captain-assignment.ts`); near expiry, `use-assignment-fallback-polling.ts` invalidates **~3.5s before** `expiresAt` to reduce stale UI after expiry.

### Verdict

- **Same source timestamp** for the offer deadline: **yes** (DB `expiredAt`).
- **Same visible countdown digits as the panel:** **no** — mobile does not implement a live second counter; it shows approximate duration + absolute time.
- **Which pending offer (multi-offer edge case):** **aligned after fix** with the map’s “soonest deadline” semantics.

---

## C. Real Expiry Behavior

### Is the window exactly 30 seconds?

- **Storage:** Each new offer gets `expiredAt = now + 30s` at creation (exact ms delta from server clock).
- **Captain action (accept/reject):** Enforced against **`Date.now()`** at request time — practically **30 seconds from assignment creation**, not “30s + poll”.

### Worker-driven expiry (no response)

- The worker only runs every **`DISTRIBUTION_POLL_MS`** (default **2000 ms**). A pending log is marked `EXPIRED` in the DB **up to ~one poll interval after** the true `expiredAt` (worst case), as noted in `env.ts`.
- **Practical “system moved on” time:** **30s + up to ~`DISTRIBUTION_POLL_MS`** for AUTO re-offer / order release, unless another tick runs sooner.

### Path-by-path

| Path | Effective offer window | Notes |
|------|------------------------|--------|
| **AUTO offer** | **30s** to accept/reject by API; background expiry **+0…poll interval** for state transition. | Same `expiredAtFromNow()`. |
| **MANUAL / DRAG_DROP** | Same **30s** for API; worker same lag for clearing stale state if no response. | Manual mode on timeout clears assignment (`MANUAL_OR_NON_AUTO_RELEASE` in `processDueTimeouts`). |
| **Reassign** | New log, new **30s** from `reassign` transaction time. | Previous pending logs cancelled in same flow. |
| **Reject** | N/A for “30s window” on same offer; **next** captain gets a **new** 30s from new log. | |

---

## D. Fixes Applied

| File | Change | Why it was safe |
|------|--------|-----------------|
| `apps/api/src/services/captain-mobile.service.ts` | `getCurrentAssignment` pending log ordering: **`orderBy: [{ expiredAt: "asc" }, { assignedAt: "desc" }]`** (was `assignedAt: "desc"` only). | Read-only semantics for “which pending offer to show” when multiple ASSIGNED/pending logs exist; matches dispatcher map’s **earliest** deadline, avoiding a rare panel-vs-app mismatch. No change to how `expiredAt` is written or enforced. |

---

## E. Remaining Risks

| Risk | Severity for QA |
|------|------------------|
| Worker processes expiry **after** true `expiredAt` by up to **`DISTRIBUTION_POLL_MS`** | Expected; document for QA. |
| Panel **ceil** vs hypothetical **floor** second display | Minor one-second display difference at boundaries. |
| Mobile **no live second counter** | Product/QA should not expect digit parity with map without a mobile UI change. |
| `assignmentOfferExpiresAt` refetched every **4s** | Rare 1s jumps in displayed seconds when ISO updates. |

---

## F. Final Answer

1. **Does the panel show the same time as the app?**  
   **Not as a live matching second counter.** Both use the same server **`expiredAt`** for the offer, but the **panel** shows a **live ceil-second** countdown; the **app** shows **static configured seconds + formatted clock time**. After the ordering fix, **which offer** is shown matches the map when multiple pending offers exist.

2. **Is the confirmation cycle really 30 seconds?**  
   **For accept/reject eligibility:** **Yes** — enforced at request time against `expiredAt`.  
   **For automatic cleanup / AUTO re-offer after silence:** **Practically 30 seconds plus up to one distribution poll interval** (default **+0–2s**).

3. **If not exactly 30s everywhere, what is the real effective behavior?**  
   **API:** hard cutoff at `expiredAt`. **Background expiry / next step:** **30s + up to `DISTRIBUTION_POLL_MS`** delay.

---

*Generated as part of a focused timing verification (2026).*
