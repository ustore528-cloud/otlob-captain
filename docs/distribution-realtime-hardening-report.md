# Distribution, Realtime & Cache — Production Hardening Audit

**Scope:** `distribution-engine`, `distribution/index`, Socket.IO hub, captain mobile React Query, assignment derivation, timeouts, accept/reject/expire/reassign paths.  
**Date:** 2026-04-19  
**Method:** Static code trace + race/cache analysis (no assumption that TypeScript = safe at runtime).

---

## A. Verdict

| Question | Answer |
|----------|--------|
| Is the current system **unsafe**? | **No single “catastrophic by design” finding**, but several **known fragility zones** (poll-bound expiry, no cross-tab coordination on client, reject path was incomplete until fix below). |
| **Fragile**? | **Yes.** Behavior under multi-instance API, clock skew, and worst-case ordering of Socket vs polling is **not fully deterministic** without ops constraints and QA. |
| **Acceptable for QA**? | **Yes**, with the fixes applied in this audit iteration and a **strict manual/stress matrix** (section G). |
| **Stable for release**? | **Not claimed.** Needs load/real-network QA, monitoring, and optional hardening (section E/F). |
| **Production-ready**? | **No** until release gate (section H) is satisfied. |

**One-line verdict:** **Fragile, QA-ready with discipline — not production-ready without further validation and ops guardrails.**

---

## B. Architecture Trace (code-grounded)

1. **Order creation** — `ordersService.create` → `orderRepository.create` → `OrderStatus.PENDING`, `distributionMode` default AUTO (or input). No assignment yet unless another flow triggers distribution.

2. **Entry into AUTO distribution** — Dispatcher/web calls `distributionService.startAuto` / `resendToDistribution` → `distributionEngine.startAutoDistribution` / `resendToDistribution` (locks order) → `offerNextAutoCaptainTx` creates `orderAssignmentLog` (PENDING, `expiredAt`), updates `order` to `ASSIGNED` + `assignedCaptainId`, notifies captain via `notificationService.notifyCaptainTx`.

3. **Socket after AUTO offer (happy path)** — `distribution/index` `emitCaptainDistributionSocket` → `emitToCaptain(userId, captain:assignment, payload)` + `emitOrderUpdated` to dispatchers room.

4. **Manual / drag-drop** — `distributionService.assignManual` → `assignManualOverride` → same pattern + `emitCaptainDistributionSocket`.

5. **Timeout worker** — `server.ts` `setInterval` → `distributionService.tickExpired` → `processDueTimeouts`:
   - Scans `orderAssignmentLog` where `PENDING` and `expiredAt <= now` (outer scan).
   - Per row: transaction + advisory lock → mark log `EXPIRED` → if `distributionMode === AUTO` and `order.status === ASSIGNED` → `offerNextAutoCaptainTx`; else release order to `PENDING` / clear assignee (manual/non-auto path).
   - On success → `emitAfterTimeoutProcessing`: `emitCaptainAssignmentEnded` for expired captain; if still `ASSIGNED` with new captain → `emitCaptainDistributionSocket(OFFER)`; else `emitOrderUpdated` for dispatchers.

6. **Captain mobile — current offer** — `GET /mobile/captain/me/assignment` → `captainMobileService.getCurrentAssignment`: requires PENDING log for captain, `expiredAt` null or `> now`, order `ASSIGNED` and `assignedCaptainId === captain.id`.

7. **Captain mobile — detail** — `GET order by id` → `toOrderDetailDto` includes `assignedCaptainId` + `assignmentLogs`.

8. **Offer UI** — `deriveFromAssignment` / `deriveFromOrder`: offer mode only if status/assignee/expiry/logs align; client-side expiry guard mirrors server where cached.

9. **Accept / reject** — `ordersService.acceptByCaptain` / `rejectByCaptain` in transaction: validate captain, order assignee, PENDING log, expiry; update logs/order; on success emit dispatcher + captain `ORDER_UPDATED`; reject emits `ASSIGNMENT_ENDED` to rejecting captain.

10. **Reject + AUTO next captain (critical path)** — After transaction, if order still `ASSIGNED` to **another** captain user id, **must** emit `captain:assignment` + `captain:order:updated` to that captain — **was missing; fixed in `orders.service.ts`** (see D).

11. **React Query** — Socket listeners call `invalidateCaptainRealtimeQueries` (assignment, me, **all order details**, notifications, history). Assignment query also refetches on interval; fallback polling near expiry invalidates assignment + **order detail** (fixed).

---

## C. Confirmed Bugs & Gaps

### C1. Missing realtime offer to next captain after reject (AUTO)

| Field | Value |
|-------|--------|
| **Severity** | **High** (delayed/missed in-app offer) |
| **Confirmed** | **Yes** (code path: `rejectByCaptain` `.then` only dispatcher + `ASSIGNMENT_ENDED` for rejector) |
| **Where** | `apps/api/src/services/orders.service.ts` |
| **Manifest** | Next captain sees offer late (polling only) or thinks no offer; dashboard may update first. |
| **User impact** | Perceived “order not reaching captain app” after another captain rejects. |

### C2. Near-expiry fallback did not invalidate order detail cache

| Field | Value |
|-------|--------|
| **Severity** | **Medium** |
| **Confirmed** | **Yes** |
| **Where** | `apps/captain-mobile/src/features/realtime/hooks/use-assignment-fallback-polling.ts` |
| **Manifest** | Detail screen could show accept while assignment tab refreshed; Socket absent or flaky. |
| **User impact** | Stale accept / wrong UI until manual refresh. |

### C3. Expiry check inside timeout transaction used outer `now`

| Field | Value |
|-------|--------|
| **Severity** | **Low** (edge timing) |
| **Confirmed** | **Suspected edge case** |
| **Where** | `apps/api/src/services/distribution/distribution-engine.ts` `processDueTimeouts` |
| **Manifest** | Rare skip/retry skew if transaction delayed vs wall clock. |
| **User impact** | Minor delay to EXPIRED processing. |

### C4. `processDueTimeouts` scan uses single `now` at start

| Field | Value |
|-------|--------|
| **Severity** | **Low–Medium** (operational) |
| **Confirmed** | **Design limitation** |
| **Where** | Same engine |
| **Manifest** | Expiry detection granularity = `DISTRIBUTION_POLL_MS` + DB latency. |
| **User impact** | Offer may appear “valid” on client for up to poll interval after true wall expiry until worker runs (mitigated by server accept/reject expiry checks and `getCurrentAssignment` filters). |

### C5. Multi-instance API / horizontal scale

| Field | Value |
|-------|--------|
| **Severity** | **Medium** (ops) |
| **Confirmed** | **Suspected** if multiple Node processes run same `setInterval` |
| **Where** | `server.ts` + `processDueTimeouts` |
| **Manifest** | Duplicate work mitigated by **per-order advisory lock**; still duplicate scans. |
| **User impact** | Extra DB load; not typically duplicate offers if lock works. |

### C6. Race: accept vs concurrent expiry

| Field | Value |
|-------|--------|
| **Severity** | **Medium** |
| **Confirmed** | **Inherent** without single-row `UPDATE … WHERE` accept |
| **Where** | `acceptByCaptain` vs `processDueTimeouts` |
| **Manifest** | Transaction ordering determines winner; user may see 409 / `OFFER_EXPIRED`. |
| **User impact** | Occasional failed accept near boundary — acceptable if UI refetches. |

### C7. Two captains “same offer”

| Field | Value |
|-------|--------|
| **Severity** | **High if occurs** |
| **Confirmed** | **Unlikely** if DB invariant holds (one PENDING per order + one assignee) |
| **Where** | Data + engine |
| **Manifest** | Would require DB inconsistency or bug in override paths. |
| **User impact** | Wrong captain accepting — mitigated by assignee + log checks server-side. |

---

## D. Fixes Applied Now

| Fix | Files | Why safe |
|-----|--------|----------|
| After reject, emit `captain:assignment` + `captain:order:updated` to **next** captain when order remains `ASSIGNED` to a different user | `apps/api/src/services/orders.service.ts` | Mirrors `distributionService` emit shape; only when `nextCaptainUserId !== userId`; uses existing hub/captain events. |
| Use `nowInTx` inside timeout transaction for expiry comparison | `apps/api/src/services/distribution/distribution-engine.ts` | Localized; reduces stale-`now` edge case. |
| Near-expiry fallback also invalidates `["captain-mobile","orders","detail"]` | `apps/captain-mobile/src/features/realtime/hooks/use-assignment-fallback-polling.ts` | Aligns with Socket invalidation breadth; read-only invalidation. |

---

## E. Top 10 Remaining Risks & Recommendations

1. **Poll-bound expiry** — Keep `DISTRIBUTION_POLL_MS` low in prod (e.g. ≤5s) or move expiry to DB/queue. *Recommendation:* env guard + alerting if poll >10s.

2. **No `captain:assignment` parity on every server path** — Any new code path that re-offers must call the same emit helper. *Recommendation:* centralize `emitOfferToAssignedCaptain(order)` in `distribution/index.ts` and reuse everywhere.

3. **Reject path was asymmetric** — Fixed for next captain; verify **no other** fork omits emits (grep `afterCaptainRejectTx` callers).

4. **Client double source of truth** — `/assignment` vs `/orders/detail` can diverge briefly. *Recommendation:* keep invalidation broad; consider single “assignment snapshot” query for offer UI only.

5. **Socket reconnect** — Listeners reattach; missed events during disconnect rely on polling. *Recommendation:* on `connect`, full invalidate (already partially via app foreground).

6. **Rapid double-tap accept** — Mutation + server idempotency not enforced. *Recommendation:* disable button while pending; optional idempotency-Key header.

7. **Clock skew client/server** — `expiredAt` is server time; client compares `Date.now()`. *Recommendation:* treat client expiry as UX hint only (already aligned with server authority on accept).

8. **Horizontal scaling** — Multiple tickers OK with locks; consider leader election for scan efficiency.

9. **Web dashboard cache** — Out of mobile scope; ensure web invalidates on same `order:updated` events.

10. **Observability** — Logs exist (`[DistributionTimeout]`, `[CaptainOrderResponse]`). *Recommendation:* ship to aggregator + dashboards for 409 rate and expire lag.

---

## F. Recommended Hardening Tasks (prioritized)

1. **P0** — Add automated integration test: reject AUTO → assert Socket mock received `captain:assignment` for captain B.  
2. **P0** — Grep audit: all code paths that set `ASSIGNED` + new PENDING log must pair with distribution emit helper.  
3. **P1** — Single exported `emitDistributionOffer(order)` used by `distribution/index`, `orders.service` (reject), and timeout emit.  
4. **P1** — Rate-limit / debounce duplicate `invalidateQueries` bursts on reconnect.  
5. **P2** — DB constraint: at most one `PENDING` assignment log per `orderId` (if business allows).  
6. **P2** — Metrics: time from `expiredAt` to `EXPIRED` row update.  
7. **P3** — Consider `SELECT … FOR UPDATE` style accept (Prisma raw) for ultra-hot contention.

---

## G. QA Stress Scenarios (harsh manual)

- Accept **1s before** `expiredAt` — expect success; dashboard + mobile updated.  
- Accept **immediately after** `expiredAt` (worker ran) — expect 409 / `OFFER_EXPIRED` or no pending; UI must not show accept after refetch.  
- **Reject** with 2+ AUTO captains — captain B receives in-app offer **without** waiting 12s poll (Socket).  
- **Reassignment** while order detail open — assignee changes; after invalidate, no ghost accept.  
- **Disconnect** socket 30s, reconnect — assignment and detail eventually consistent.  
- **Background → foreground** — `invalidateQueries` for assignment fires; detail not stale.  
- **Two rapid** `order:updated` / assignment events — UI stable, no duplicate toasts.  
- **Slow network** — accept mutation shows loading; no double success.  
- **Repeated manual reassignment** from web — logs + assignee + sockets consistent.  
- **Stale detail** on old captain after reassign — should 403 or show read-only; captain A must not accept.

---

## H. Release Gate (production-ready conditions)

- [ ] Stress QA matrix (G) passed on **real device + LAN + production-like API**.  
- [ ] No P0 open bugs in assignment/realtime paths.  
- [ ] `DISTRIBUTION_POLL_MS` and `DISTRIBUTION_TIMEOUT_SECONDS` documented and validated in staging.  
- [ ] Socket TLS and JWT refresh tested on production build.  
- [ ] Monitoring for 409 `INVALID_STATE` / `OFFER_EXPIRED` rates and p95 expiry lag.  
- [ ] Runbook: multi-instance API, DB failover, Socket sticky (if any).  
- [ ] Optional: DB uniqueness / constraint review for assignment logs.

---

## Files Reviewed (non-exhaustive but targeted)

- `apps/api/src/server.ts`  
- `apps/api/src/services/distribution/distribution-engine.ts`  
- `apps/api/src/services/distribution/index.ts`  
- `apps/api/src/services/distribution/constants.ts`  
- `apps/api/src/services/distribution/order-lock.ts`  
- `apps/api/src/services/distribution/round-robin.ts`  
- `apps/api/src/services/orders.service.ts`  
- `apps/api/src/services/captain-mobile.service.ts`  
- `apps/api/src/dto/order.dto.ts`  
- `apps/api/src/realtime/hub.ts`, `order-emits.ts`, `captain-events.ts`  
- `apps/captain-mobile/src/services/distribution/*` (N/A — mobile uses API)  
- `apps/captain-mobile/src/features/realtime/*`  
- `apps/captain-mobile/src/features/assignment/utils/captain-order-actions.ts`  
- `apps/captain-mobile/src/features/assignment/hooks/use-captain-order-mutations.ts`  
- `apps/captain-mobile/src/hooks/api/use-captain-assignment.ts`  
- `apps/captain-mobile/src/features/realtime/hooks/use-assignment-fallback-polling.ts`  

---

*End of report.*
