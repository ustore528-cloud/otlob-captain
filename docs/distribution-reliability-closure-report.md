# Distribution Reliability — Closure Report (Hardening Pass)

**Purpose:** Close top reliability gaps toward **QA Ready** (not claim production perfection).  
**Scope:** Timeout worker, multi-instance awareness, cache coherence, operational guards, logging correlation.

---

## A. Current State

The captain order distribution path is **no longer “fragile by omission”** on several fronts: reject→next-captain realtime, detail invalidation on fallback polling, assignment/detail/history alignment on socket events, in-process tick overlap protection, and explicit documentation of multi-instance limits.

Remaining limitations are **documented**, not hidden: poll-granularity for expiry, unavoidable races at accept/expiry walls without architectural change, and horizontal-scale tick duplication without a distributed leader.

**Honest summary:** **Suitable for structured QA** on staging/real devices; **not** a statement of production SLO compliance until QA gate (section F) passes.

---

## B. Remaining Top Risks (classified)

| Risk | Severity | Confirmed / Suspected | Fixability | Impact |
|------|----------|----------------------|------------|--------|
| Poll-cycle expiry detection (`DISTRIBUTION_POLL_MS`) | Medium | **Confirmed** design | **QA + ops** (env tuning); sharper timing needs **scheduler/DB** (architectural) | Delayed EXPIRED vs wall clock by up to one poll interval |
| Accept vs expire concurrent transaction | Low–Medium | **Confirmed** possible | **QA + UI** (refetch on 409); full elimination needs **DB-level conditional update** (arch) | Occasional 409 near boundary |
| Multiple API instances, multiple `tickExpired` loops | Medium (ops) | **Confirmed** | **Ops** (single leader / external cron) or **accept** duplicate work cost | Extra DB load; per-order lock limits corruption |
| Client clock skew vs `expiredAt` | Low | **Suspected** edge | **Acceptable** — server is authority; client hints only | Rare UI mismatch until refetch |
| Socket missed during long offline | Medium | **Suspected** | **QA** + existing polling / foreground invalidate | Delayed UI until next refetch |

**Classification:**

| Category | Items |
|----------|--------|
| **Fixed or mitigated now** | In-process tick overlap; prod warning for high `DISTRIBUTION_POLL_MS`; `TICK_START` log; history invalidation on socket path; engine comment on multi-instance |
| **Needs architectural decision** | Global single scheduler for expiry; conditional `UPDATE` for accept; Redis leader for tick |
| **Needs QA only** | End-to-end scenarios, slow network, two devices |
| **Acceptable known behavior** | 409 when offer expired or lost race; brief staleness until invalidate completes |

---

## C. Safe Fixes Applied Now

| Change | Files | Why safe |
|--------|-------|----------|
| **Reentry guard** for `tickExpired`: skip new tick if previous still running (same process) | `apps/api/src/server.ts` | Prevents pile-up and overlapping `processDueTimeouts` when DB is slow; no API contract change |
| **Production warning** if `DISTRIBUTION_POLL_MS > 5000` | `apps/api/src/config/env.ts` | Read-only operational signal; does not change runtime logic |
| **`TICK_START`** log at beginning of `tickExpired` | `apps/api/src/services/distribution/index.ts` | Correlates logs per sweep; no behavior change |
| **Comment** on multi-instance + advisory lock limits | `apps/api/src/services/distribution/distribution-engine.ts` | Documents invariant; no logic change |
| **Invalidate `history`** queries on socket events (parity with mutation invalidation) | `apps/captain-mobile/src/features/realtime/invalidate-captain-realtime-queries.ts` | Broader React Query coherence; read-only refetch triggers |

**Previously applied (this hardening wave builds on):** reject→next captain `captain:assignment`; fallback polling invalidates order detail; `nowInTx` in expiry transaction.

---

## D. Known Acceptable Behaviors

1. **409 / `INVALID_STATE` / `OFFER_EXPIRED` near expiry** — Two transactions (accept vs expire) cannot both win; one fails. **UI should:** refetch assignment + detail, clear offer affordances, show Arabic/ clear message (already partially mapped in `error-format.ts`).

2. **Expiry not instant at T+30.000s** — Worker runs on poll interval. **Acceptable** if `DISTRIBUTION_POLL_MS` is kept low in prod and monitoring watches lag.

3. **Multi-instance** — Duplicate scans are **acceptable** if DB and locks hold; **not acceptable** for cost at very large scale without leader election — **operational** follow-up.

---

## E. Risks Still Open

- No **distributed** mutex for `tickExpired` across nodes.
- No **single conditional UPDATE** for accept (optimistic locking version column).
- **Poll-based** expiry remains; replacing it requires job queue / pg_cron / etc.
- **Automated E2E** tests not added in this pass.

---

## F. QA Gate Checklist (Fragile → QA Ready)

- [ ] **AUTO reject chain:** captain B receives `captain:assignment` without waiting only on poll.
- [ ] **Timeout chain:** after ~30s + poll, captain A loses offer; captain B or PENDING per mode; dashboard matches.
- [ ] **Near-expiry accept:** acceptable 409; UI refetches and hides accept.
- [ ] **Socket disconnect 60s:** assignment + detail + history list converge without manual refresh only if needed once.
- [ ] **Production env:** `DISTRIBUTION_POLL_MS` ≤ 5000; warning absent or acknowledged.
- [ ] **Logs:** `TICK_START` appears each interval; no unbounded `tickExpired skipped` spam under normal load (investigate if constant).
- [ ] **Two phones:** no double-accept on same order (one succeeds, one 409).

---

## G. Final Verdict

### **QA Ready**

**Justification:** Targeted hardening closes **confirmed** gaps (realtime after reject, cache breadth, tick overlap, ops visibility, documented multi-instance behavior). Remaining issues are **bounded**, **documented**, and **testable** via section F. **Production Ready** is **not** claimed: requires passing QA gate, production env discipline, and optional architectural follow-ups from section E.

---

*End of closure report.*
