# Overflow — Staging / Device QA Execution Results

**Run sheet (source of truth):** [`overflow-staging-device-qa-run-sheet.md`](./overflow-staging-device-qa-run-sheet.md)

**Last update:** 2026-04-20  
**Scenario 4 execution path (when run):** **primary OFFER + overflow ACTIVE** (documented analogue — not “primary ACTIVE + overflow OFFER” steady state).

---

## Blocking reason (applies to all scenarios unless noted)

**BLOCKED — execution environment:** The automated executor in this Cursor session **cannot** attach to a **physical Android device**, run an **emulator with interactive UI**, obtain **JWT-authenticated** responses from staging for `GET /api/v1/mobile/captain/me/assignment` and `/me/assignment/overflow`, or **capture** screenshots, screen recordings, or timestamped transition logs. **`adb` is not available** in this shell. **No staging captain credentials or dispatcher session** were provided to the executor.

Therefore **no scenario was executed** on hardware; results below are **BLOCKED**, not PASS or FAIL.

**Priority batch (1, 2, 3, 5, 6, 12):** same block — not partially run.

---

## Completed QA execution table

| Scenario | Tester | Device | Build | Pass/Fail | Notes | Evidence captured |
|----------|--------|--------|-------|-----------|-------|-------------------|
| 1 | — | — | — | **BLOCKED** | No physical device/emulator + no staging authenticated session in executor environment | — |
| 2 | — | — | — | **BLOCKED** | Same | — |
| 3 | — | — | — | **BLOCKED** | Same (priority batch) | — |
| 4 (analogue: OFFER + overflow ACTIVE) | — | — | — | **BLOCKED** | Same | — |
| 5 | — | — | — | **BLOCKED** | Same (priority batch) | — |
| 6 | — | — | — | **BLOCKED** | Same (priority batch) | — |
| 7 | — | — | — | **BLOCKED** | Same; requires network control on device | — |
| 8 | — | — | — | **BLOCKED** | Same | — |
| 9 | — | — | — | **BLOCKED** | Same | — |
| 10 | — | — | — | **BLOCKED** | Same | — |
| 11 | — | — | — | **BLOCKED** | Same | — |
| 12 | — | — | — | **BLOCKED** | Same (priority batch) | — |

**Human QA:** re-run on device; replace **BLOCKED** with **PASS** or **FAIL**; fill Tester / Device / Build; attach evidence paths below.

---

## Evidence bundle paths

| Path | Status |
|------|--------|
| `docs/evidence/overflow-staging-qa/` | **Not created** — no device run, no artifacts |
| Per-scenario JSON (`assignment.json`, `overflow.json`) | **Not captured** |
| Screenshots / `.mp4` | **Not captured** |

**Recommended layout after real execution:**

```
docs/evidence/overflow-staging-qa/YYYY-MM-DD/
  README.txt                 # tester, device, OS, build id, API base URL (redact secrets)
  scenario-01/
    assignment.json
    overflow.json
    screenshot-primary.png
  ...
```

---

## Final PASS / FAIL summary

| Category | Count |
|----------|-------|
| PASS | **0** |
| FAIL | **0** |
| BLOCKED | **12** |

**Exit criteria (run sheet):** **Not satisfied** — physical Android PASS set not achieved; scenarios 7–11 not executed; P1 verification on device not done.

---

## Final recommendation

**NO-GO** for broader rollout until a **human tester** completes the run sheet on **at least one physical Android device** (emulator optional per run sheet), achieves **PASS** on required scenarios, attaches **evidence bundle** with payloads + media, and confirms **Final Exit Criteria** in [`overflow-staging-device-qa-run-sheet.md`](./overflow-staging-device-qa-run-sheet.md).

---

*Update this file in place after real-device execution; do not delete the run sheet.*
