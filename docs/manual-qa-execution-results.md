# Manual QA — Execution Results (fill during testing)

**Source of truth with:** `manual-qa-distribution-stress-plan.md`, `android-apk-real-device-test-plan.md`  
Use during **real** sessions only.

---

## Run These First (quick-start)

1. **Run in order:** **S1 → S2 → S3 → S4 → E7** (do not skip S1).
2. **Evidence every time:** order **ID**, **local timestamps** (offer seen, tap, panel change), **API line** if error, **one screenshot** per scenario minimum on fail; on pass still note time + order ID.
3. **When to stop and mark a blocker**
   - **Stop the session** if **S1 fails** (captain never receives an offer on device with correct `EXPO_PUBLIC_API_URL` and healthy network) — **do not run S2–E7** until fixed or explicitly waived in **Notes**.
   - **Stop before S1** if: API unreachable, login fails, or dispatcher cannot create order — record as **blocker**, fix env, re-run later.
4. After S1 passes, continue unless a scenario **fails** — mark **Pass/Fail** and note **blocker vs non-blocker** before closing the doc.

---

## 1. Operator execution checklist (before first tap)

**Environment (write in §2)**

| Check | |
|-------|---|
| `EXPO_PUBLIC_API_URL` | No trailing slash; **LAN IP** on real phone (not `localhost`). |
| API | `0.0.0.0` listener; firewall allows port; same Wi‑Fi as phone. |
| `DISTRIBUTION_TIMEOUT_SECONDS` | e.g. **30** (note exact value). |
| `DISTRIBUTION_POLL_MS` | e.g. **2000** (note exact value). |

**Accounts**

| Role | Minimum |
|------|---------|
| Dispatcher / admin | 1 logged in on web |
| Captain A | 1 device, logged in |
| Captain B | 1 device or second session for S3 / chain |
| Eligibility | Captains **AVAILABLE** / active per product rules |

**Logs to keep visible**

| Where | Watch for |
|-------|------------|
| API terminal / host | `[DistributionTimeout]`, `TICK_START`, `[CaptainOrderResponse]`, `REJECT_EMIT_NEXT_OFFER` |
| Metro (Expo only) | `[CaptainAssignment]`, `[CaptainOrder]`, `SOCKET_INVALIDATE` |
| Device | Error alerts, 409 messages |

**Prerequisites**

- [ ] Health / login works from phone browser or app `me` loads  
- [ ] Dispatcher can create an **AUTO** order  
- [ ] Optional: `npm run db:demo-reset -w @captain/api` on **non-prod** DB only  

---

## 2. Test session info

| Field | Value |
|-------|-------|
| **Date** | YYYY-MM-DD |
| **Environment** | e.g. local LAN / staging |
| **API base URL** | |
| **App build / source** | Expo Go / dev / EAS APK profile + build # |
| **Tester name** | |
| **Dispatcher / admin name** | |
| **Captain A / B identifiers** | |
| **DISTRIBUTION_TIMEOUT_SECONDS** | |
| **DISTRIBUTION_POLL_MS** | |
| **DB / seed notes** | demo-reset Y/N |

---

## 3. Critical scenarios — results (S1 → S2 → S3 → S4 → E7)

### S1 — Create order → AUTO → captain receives offer

| Field | |
|-------|--|
| **Purpose** | First end-to-end: offer reaches device. |
| **Order ID** | |
| **T_start (local)** | |
| **T_offer_seen (local)** | |
| **T_end (local)** | |
| **Setup** | Dispatcher + Capt A + AUTO order creation path. |
| **Steps** | 1) Create AUTO order. 2) Dashboard/distribution check. 3) Capt A: Orders / assignment until offer appears. |
| **Expected** | A sees offer; panel consistent. |
| **Actual** | |
| **Pass / Fail** | ☐ Pass ☐ Fail |
| **Blocker?** | ☐ Yes (stop session) ☐ No |
| **Screenshots / log refs** | |
| **Notes** | |

---

### S2 — Accept before expiry + panel consistency

| Field | |
|-------|--|
| **Order ID** | |
| **T_tap_accept (local)** | |
| **T_panel_updated (local)** | |
| **Setup** | Active offer (from S1 or new order). |
| **Steps** | Accept before expiry; check app + dispatcher status. |
| **Expected** | Success; ACCEPTED; panel matches. |
| **Actual** | |
| **Pass / Fail** | ☐ Pass ☐ Fail |
| **Blocker?** | ☐ Yes ☐ No |
| **Screenshots / log refs** | |
| **Notes** | |

---

### S3 — Reject before expiry (AUTO) → next captain receives offer

| Field | |
|-------|--|
| **Order ID** | |
| **T_reject (local)** | |
| **T_B_offer (local)** | |
| **Setup** | New order → A; B ready. |
| **Steps** | A rejects; B should get offer; A cleared. |
| **Expected** | B offer; API may log `REJECT_EMIT_NEXT_OFFER`. |
| **Actual** | |
| **Pass / Fail** | ☐ Pass ☐ Fail |
| **Blocker?** | ☐ Yes ☐ No |
| **Screenshots / log refs** | |
| **Notes** | |

---

### S4 — No response until timeout → reassignment / stop

| Field | |
|-------|--|
| **Order ID** | |
| **T_wait_start (local)** | |
| **T_A_cleared (local)** | |
| **T_next_or_pending (local)** | |
| **Setup** | Offer to A only; **no** accept/reject. |
| **Steps** | Wait timeout + poll + ~10s buffer; observe A and dispatcher. |
| **Expected** | A loses offer; AUTO chain or stop per rules. |
| **Actual** | |
| **Pass / Fail** | ☐ Pass ☐ Fail |
| **Blocker?** | ☐ Yes ☐ No |
| **Screenshots / log refs** | |
| **Notes** | |

---

### E7 — Order detail open during reassignment (no invalid accept)

| Field | |
|-------|--|
| **Order ID** | |
| **T_detail_open (local)** | |
| **T_reassign (local)** | |
| **T_attempt_accept (local)** | |
| **Setup** | A on **detail** screen; dispatcher reassigns (or timeout moves offer). |
| **Steps** | Reassign; A tries accept or observe button. |
| **Expected** | 409 / no button / no wrong accept. |
| **Actual** | |
| **Pass / Fail** | ☐ Pass ☐ Fail |
| **Blocker?** | ☐ Yes ☐ No |
| **Screenshots / log refs** | |
| **Notes** | |

---

## 4. Logs checklist (per session)

- [ ] API: `[DistributionTimeout]`, `TICK_START`, `[CaptainOrderResponse]`, `REJECT_EMIT_NEXT_OFFER` (if S3)
- [ ] Metro/device: `[CaptainAssignment]`, `[CaptainOrder]`, errors
- [ ] Dispatcher: status + **wall-clock times** for create/assign/accept
- [ ] Any **409**, `OFFER_EXPIRED`, network failure — paste snippet + time

---

## 5. Bug capture template (copy per bug)

```
Bug title:
Severity: P0 / P1 / P2 / P3
Scenario ID: (S1, S2, …)

Reproduction steps:
1.
2.
3.

Expected behavior:

Actual behavior:

Probable subsystem: (API / mobile RQ+socket / web / DB)

Evidence:
- Screenshot:
- Log excerpt:
- Order ID:
- Time (local):
```

---

## 6. Exit summary

| Metric | Value |
|--------|-------|
| **Scenarios executed** | / 5 |
| **Passed** | |
| **Failed** | |
| **Blockers** | |
| **Non-blockers** | |

**Recommended verdict** (after review):

- [ ] Remain QA Ready  
- [ ] Move to Release Candidate  
- [ ] Block release  

| Role | Name | Date |
|------|------|------|
| Tester | | |
| Owner | | |

---

*Full scenario detail: `docs/manual-qa-distribution-stress-plan.md`. Android device/APK: `docs/android-apk-real-device-test-plan.md`.*
