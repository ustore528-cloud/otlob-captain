# Manual QA — Distribution & Captain Order Flow (Stress Plan)

**Verdict context:** QA Ready, **not** Production Ready.  
**Goal:** Executable validation on **real API + DB + captain mobile + dispatcher web** before promoting to Release Candidate.

---

## 1. Environment Setup

### 1.1 API (`apps/api/.env`)

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` | Yes | Same DB all testers use. |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Yes | Min length per `env.ts`. |
| `PORT` | Optional | Default `4000`. |
| `CORS_ORIGIN` | Dev: `*` OK | Staging: real web origin. |
| `DISTRIBUTION_TIMEOUT_SECONDS` | Recommended **`30`** | Matches product spec; use **`10`** only for faster stress iteration (document in run notes). |
| `DISTRIBUTION_POLL_MS` | Recommended **`2000`** | Keeps expiry detection tight; **must be ≤5000** for staging QA to avoid “mystery delays.” |
| `DISTRIBUTION_MAX_ATTEMPTS` | Default `30` | Lower only if testing exhaustion explicitly. |

**Production-warning check:** If `NODE_ENV=production` and `DISTRIBUTION_POLL_MS > 5000`, API should log a **warn** at startup — note whether it appears.

### 1.2 Captain mobile (`apps/captain-mobile/.env`)

| Variable | Required |
|----------|----------|
| `EXPO_PUBLIC_API_URL` | `http://<host-LAN-IP>:4000` (no trailing slash) |

Reload Metro after changes (`expo start -c` if needed).

### 1.3 Web dispatcher / admin

- Same API base URL as mobile (through Vite env if applicable).
- Browser on same LAN or VPN as API.

### 1.4 Accounts & captains

| Need | Minimum |
|------|---------|
| Dispatcher / admin user | **1** (create orders, distribution page, manual assign). |
| Captain logins | **≥2** for AUTO re-offer and reassignment tests; **≥3** ideal for round-robin stress. |
| Store | At least one active store tied to order creation (per product rules). |

### 1.5 Seed / demo reset (optional but recommended)

From repo root or `apps/api`:

```bash
npm run db:demo-reset -w @captain/api
```

This script resets demo orders and ensures **3 demo captains** with known phones (see `apps/api/scripts/distribution-demo-reset.ts`). Use **only on non-production DB**.

**Prerequisites:** migrations applied, `DATABASE_URL` valid.

---

## 2. Core Success Scenarios

For each: record **time**, **order id**, **captain ids**, and **pass/fail** in the matrix (section 6).

### S1 — Create order → AUTO assign → captain receives offer

| Step | Action |
|------|--------|
| 1 | Dispatcher: create new order with **AUTO** distribution (or trigger auto flow per UI). |
| 2 | Confirm order appears on **dashboard** list / home. |
| 3 | Open **distribution** page; confirm order visible (map/cards per UI). |
| 4 | Captain A (assigned): open app → **Orders** tab → **current assignment** or offer UI appears within **~15s** (socket) or **≤12s** extra (assignment poll) + fallback rules. |
| 5 | Verify **offer** UI: accept/reject visible **only** if assignment valid (per current app logic). |

**Pass:** Captain A sees offer; dashboard shows assigned/waiting state consistent with API.  
**Fail:** No offer after **60s** with healthy network and server; or wrong captain sees offer. **Severity: P0.**

**Monitor:** API: `[DistributionTimeout]` only if timeout path runs; `captain:assignment` path not always logged — use **`[CaptainOrderResponse]`** only on accept/reject. Mobile: `[CaptainAssignment] FETCH_SUCCESS`, `SOCKET_INVALIDATE` on events; `[CaptainOrder]` on accept/reject clicks.

---

### S2 — Accept before expiry

| Step | Action |
|------|--------|
| 1 | With offer visible, tap **قبول** within well before `DISTRIBUTION_TIMEOUT_SECONDS`. |
| 2 | Confirm app shows **accepted / next step** (e.g. delivery actions). |
| 3 | Dispatcher: order status updates to **accepted** (or equivalent). |

**Pass:** Success; no `409` / `No pending assignment`.  
**Fail:** Error after tap; dashboard stuck. **Severity: P0.**

**Monitor:** API `[CaptainOrderResponse] ACCEPT_SUCCESS`; mobile `accept_HTTP_OK`.

---

### S3 — Reject before expiry (AUTO → next captain)

| Step | Action |
|------|--------|
| 1 | New order, offer to Captain A. |
| 2 | Captain A taps **رفض** before expiry. |
| 3 | **Captain B** should receive offer (AUTO) — in-app **without** waiting only on slow poll ideally. |
| 4 | Dispatcher: state shows new assignee or pending per rules. |

**Pass:** B gets offer via socket-driven refresh or quick poll; **no** ghost offer on A after reject.  
**Fail:** B never gets offer; A still sees accept. **Severity: P0 / P1.**

**Monitor:** API `[CaptainOrderResponse] REJECT_SUCCESS`, **`REJECT_EMIT_NEXT_OFFER`** (next captain); `[DistributionTimeout]` not required. Mobile: `reject_HTTP_OK`, `SOCKET_INVALIDATE`.

---

### S4 — No response → timeout → AUTO reassignment (or pool empty)

| Step | Action |
|------|--------|
| 1 | New order; offer goes to Captain A. |
| 2 | **Do not** accept or reject; wait **timeout + poll** (e.g. **30s + up to DISTRIBUTION_POLL_MS** + small buffer). |
| 3 | Expect: A loses offer (`ASSIGNMENT_ENDED` or empty assignment); B gets offer **if** pool allows; else order returns **PENDING** per engine. |

**Pass:** Matches product (AUTO chain or stop).  
**Fail:** A still shows accept after **45s+** with `POLL_MS=2s`. **Severity: P0.**

**Monitor:** API `[DistributionTimeout] TICK_START`, `PROCESS_OK`, `AUTO_REOFFER_OK` or `AUTO_REOFFER_STOPPED`, `EMIT_AFTER_TIMEOUT_OK`. Mobile: `SOCKET_INVALIDATE`, assignment refetch.

---

### S5 — Order detail screen sync

| Step | Action |
|------|--------|
| 1 | Open **order detail** for active offer (`captain://order/...` or in-app navigation). |
| 2 | From dispatcher, **reassign** or let timeout move offer. |
| 3 | Detail screen should **not** keep stale accept after invalidate/refetch. |

**Pass:** Accept hidden or error only after legitimate expiry/reassign.  
**Fail:** Stale accept succeeds on server (should 409) or button stays visible without refetch. **Severity: P1.**

**Monitor:** Mobile `SOCKET_INVALIDATE`; `[CaptainOrder] accept_VALIDATE` blocked if stale.

---

### S6 — Orders list / history / detail coherence

| Step | Action |
|------|--------|
| 1 | After accept/reject/timeout, open **history** list and **detail** for same order id. |
| 2 | Status and assignee match **GET** `/me/assignment` and dispatcher view. |

**Pass:** Single story across screens.  
**Fail:** History shows old status >30s after event. **Severity: P1.**

**Monitor:** React Query refetch; socket invalidations hit `history` + `detail` keys.

---

### S7 — In-app notifications (if used)

| Step | Action |
|------|--------|
| 1 | Trigger order events from dispatcher. |
| 2 | Notifications list loads; tap opens order if linked. |

**Pass:** No crash; data not contradicting assignment API.  
**Fail:** Opens wrong order. **Severity: P1.**

**Note:** Push FCM/APNs may be out of scope; in-app list is REST-based per `manual-qa-captain-mobile.md`.

---

## 3. Edge / Stress Scenarios

### E1 — Accept ~1s before expiry

**Steps:** Note server time or UI countdown; tap accept at **~1s** before `expiresAt`.  
**Pass:** Success **or** clear `409` / Arabic message if server already expired; **no** silent wrong state.  
**Fail:** Success + wrong DB state; or crash. **P0.**

**Monitor:** `[CaptainOrderResponse] ACCEPT_OK_PENDING_LOG` vs `ACCEPT_REJECT_LOG_EXPIRED`.

---

### E2 — Accept right after expiry

**Steps:** Let offer expire; wait for worker (`TICK_START` + processing); attempt accept.  
**Pass:** **409** / no pending; UI clears offer after refetch.  
**Fail:** Accept succeeds twice or for wrong assignment. **P0.**

---

### E3 — Reject at timeout boundary

**Steps:** Reject in the same **2–5s** window as expiry (hard).  
**Pass:** Exactly one outcome: reject **or** expire (one may 409); DB consistent.  
**Fail:** Duplicate next offers or two active PENDING. **P0.**

---

### E4 — Background → foreground

**Steps:** Put app in background **15s**; return to foreground on Orders/assignment.  
**Pass:** `APP_FOREGROUND_INVALIDATE` or refetch; assignment matches server.  
**Fail:** Stale offer until manual pull only **and** no socket. **P2** if socket healthy.

---

### E5 — Socket disconnect / reconnect

**Steps:** Disable Wi‑Fi **10–20s** on device; re-enable.  
**Pass:** Socket reconnects; assignment catches up within **fallback** window (see `use-assignment-fallback-polling` / interval).  
**Fail:** Permanent stale state. **P1.**

**Monitor:** `[CaptainAssignment] SOCKET_INVALIDATE`; API no spam errors.

---

### E6 — Slow / unstable network

**Steps:** Throttle network (Chrome DevTools / iOS Network Link / Android emulator).  
**Pass:** Loading states; eventual consistency; no duplicate success on double tap (button disabled while pending).  
**Fail:** Duplicate accepted orders in DB. **P0** if occurs.

---

### E7 — Stale detail during reassignment

**Steps:** Captain A opens **detail**; dispatcher **reassigns** to B.  
**Pass:** A’s detail stops showing valid accept for B’s order; refetch or error.  
**Fail:** A accepts successfully. **P0.**

---

### E8 — Repeated manual reassignment

**Steps:** Dispatcher drags/reassigns same order **5×** quickly (within reason).  
**Pass:** Single PENDING assignee; captain sockets/invalidate sane.  
**Fail:** Conflicting logs or 500s. **P1.**

---

### E9 — AUTO vs MANUAL

**Steps:** Same as S1/S4 but **MANUAL** assign: timeout should **not** auto chain to next captain (product rule); order falls back to **PENDING** / dispatcher handling.  
**Pass:** Behavior matches `distribution-engine` (non-AUTO branch).  
**Fail:** Unexpected auto offer to another captain. **P0** if unintended.

---

### E10 — Two captains toggling availability rapidly

**Steps:** Toggle AVAILABLE/OFFLINE on two devices in short succession during distribution.  
**Pass:** No crash; pool eventually consistent.  
**Fail:** Offer to offline captain only. **P2** (eligibility rules).

---

### E11 — Rapid events / invalidations

**Steps:** Dispatcher + captain actions in quick succession.  
**Pass:** UI stabilizes; no runaway Metro logs; no memory blowup.  
**Fail:** Unbounded errors. **P2.**

---

## 4. Multi-Instance / Operational Scenarios

### M1 — Two API processes (same DB)

**Setup:** Run **two** Node API instances on **different ports** against **same** `DATABASE_URL` (staging only).

**Observe:**

- Both emit `TICK_START` on each interval → duplicate **scan** work expected.
- **Per-order advisory lock** should prevent double-processing the **same** expiry for the same row in most cases.

**Pass:** No duplicate contradictory **assignment** rows for same order; DB sane after stress.  
**Fail:** Repeated `AUTO_REOFFER` glitches or deadlocks. **P1** — escalate architecture (leader election).

**Monitor:** `[DistributionTimeout] TICK_START` count ≈ **2×** frequency; watch `PROCESS_FAIL` / DB errors.

---

### M2 — Tick overlap (single instance)

**Setup:** Artificially slow DB **or** very fast `DISTRIBUTION_POLL_MS` abuse.

**Observe:** `[Distribution] tickExpired skipped: previous tick still in flight` (server **warn**).

**Pass:** No nested pile-up; timeouts still processed.  
**Fail:** Starvation (never finishing ticks). **P2.**

---

## 5. Logs to Monitor

### API (stdout / Railway / Docker)

| Prefix / pattern | Meaning |
|------------------|---------|
| `[DistributionTimeout]` | Timeout worker: `TICK_START`, `SCAN`, `PROCESS_OK`, `AUTO_REOFFER_*`, `EMIT_AFTER_TIMEOUT_*` |
| `[CaptainOrderResponse]` | Accept/reject: `ACCEPT_REQUEST`, `ACCEPT_SUCCESS`, `REJECT_*`, `REJECT_EMIT_NEXT_OFFER` |
| `[Distribution] tickExpired` | Uncaught error in tick |
| `[Distribution] tickExpired skipped` | In-process overlap guard |
| Startup warn | High `DISTRIBUTION_POLL_MS` in production |

### Metro / React Native (`__DEV__` / console)

| Prefix | Meaning |
|--------|---------|
| `[CaptainAssignment]` | `FETCH_*`, `SOCKET_INVALIDATE`, `APP_FOREGROUND_INVALIDATE` |
| `[CaptainOrder]` | `accept_CLICK`, `*_VALIDATE`, `*_HTTP_OK` / `*_HTTP_ERR` |

### Dispatcher web

- Socket `order:updated` or app refetch behavior (per web implementation).
- Distribution UI updates when order moves.

---

## 6. Pass/Fail Matrix (summary)

| ID | Scenario | Expected | Failure | Sev | Likely subsystem |
|----|----------|----------|---------|-----|-------------------|
| S1 | End-to-end offer | A sees offer; dashboard ok | No offer / wrong captain | P0 | API emit, mobile cache, eligibility |
| S2 | Accept early | 200, state ACCEPTED | 409 spurious | P0 | orders.service, mobile |
| S3 | Reject → B | B offer; A clean | B never gets offer | P0/P1 | reject emit, socket, RQ |
| S4 | Timeout AUTO | Re-offer or stop per rules | Stuck on A | P0 | tickExpired, engine |
| S5 | Detail sync | No stale accept | Ghost accept | P1 | invalidate, detail |
| E2 | Post-expiry accept | 409, UI clean | Double accept | P0 | transactions |
| E7 | Detail + reassign | A cannot take B’s | Wrong accept | P0 | authz, DTO assignee |
| M1 | 2 API instances | DB consistent | Duplicate weird state | P1 | ops / scaling |

*(Extend rows for every scenario you execute.)*

---

## 7. QA Exit Criteria (QA Ready → Release Candidate)

All must be **true** for **Release Candidate**:

1. **S1–S4** pass on **real device + LAN** with `DISTRIBUTION_TIMEOUT_SECONDS=30`, `DISTRIBUTION_POLL_MS≤5000`.
2. **S3** confirms **next captain** receives realtime path (not only after manual refresh).
3. **E2** and **E7** pass — no authorization regression.
4. **No P0 failures** in matrix for two consecutive full runs on **staging**.
5. **Startup / logs:** No unexplained `TICK_EXPIRED_FAIL` storms; `tickExpired skipped` occasional under load OK, not constant.
6. **Dispatcher + mobile** status agree on sampled orders (spot-check **10** orders).
7. **Sign-off:** Owner accepts remaining **open risks** from `distribution-reliability-closure-report.md` (poll granularity, multi-instance).

---

## 8. Final Recommendation (pre-fill; update after test run)

**Before running tests:**  
→ **Proceed with broader QA** on staging using this plan; **not** a general release. **APK / internal test build** is appropriate; treat as **staging rollout** until exit criteria pass.

**After all Section 7 criteria pass:**  
→ Update this line to: **Ready to promote build to Release Candidate** (still not “Production Ready” until ops/SLO sign-off).

**If any P0 reproduces:**  
→ **Block release**; fix or document waiver with owner approval.

---

*Document version: 1.0 — align with `docs/distribution-reliability-closure-report.md` and `docs/manual-qa-captain-mobile.md`.*
