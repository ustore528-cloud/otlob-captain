# Pre-launch large multi-tenant QA (QA-STRESS-)

Synthetic load for **multi-tenant isolation** checks before any public launch. **No real customers or captains.**

## Target size (default scripts)

| Item | Target |
|------|--------|
| Companies | **10** — `QA-STRESS-Company-001` … `010` |
| Branches | **20** — `QA-STRESS-C00N-Branch-001/002` per company |
| Stores | **20** — one per branch (`QA-STRESS-C00N-B00M-STORE`) |
| Captains | **50** — 5 × 10 (`QA-STRESS-C00N-Captain-001` … ) |
| Orders | **300** — 30 × 10 (`QA-STRESS-C00N-ORDER-0001` … ) |

Configurable via CLI flags (`--companies`, `--branches-per-company`, `--captains-per-company`, `--orders-per-company`).

Customer name on orders: **`QA-STRESS Customer`**. Notes: **`QA-STRESS-DO-NOT-PROCESS`**.

## Prerequisites

- `DATABASE_URL` in `apps/api/.env` (prefer a **disposable** DB or confirmed pre-launch stack).
- **Backup** the database before `--apply` seed or cleanup.
- **No destructive migrations** as part of this plan.
- **Public launch** remains blocked until QA passes.

## Part A — Seed (idempotent)

From `apps/api`:

```bash
npx tsx scripts/qa-stress-seed.ts --dry-run --companies=10 --branches-per-company=2 --captains-per-company=5 --orders-per-company=30
```

Apply (requires explicit confirmation env):

```bash
QA_STRESS_CONFIRM=YES npx tsx scripts/qa-stress-seed.ts --apply --companies=10 --branches-per-company=2 --captains-per-company=5 --orders-per-company=30
```

- **Apply** is refused unless `QA_STRESS_CONFIRM=YES`.
- Re-running **does not duplicate** rows keyed by company name, branch name, store name, captain `fullName`, or `orderNumber`.
- Default password for new users: `QA_STRESS_DEFAULT_PASSWORD` env or built-in fallback (stderr reminds you — do not reuse in production).

Writes `apps/api/tmp/qa-stress-seed-summary.json` (**created vs reused** counts).

## Part B — Read-only verify

```bash
cd apps/api
npx tsx scripts/qa-stress-verify-readonly.ts --strict --expect-companies=10 --expect-branches=20 --expect-captains=50 --expect-orders=300
```

Checks include: companies/branches/captains/orders (strict tenant naming), FK presence, **cross-company assignment joins**, duplicate `PENDING` logs per order, stuck-ish operational statuses, rejected/expired log counts (when dispatch runs).

Output: **`tmp/qa-stress-verify-summary.json`** and stdout JSON. Exit **1** when `--strict` and any gate fails.

## Part C — Manual / dispatch QA (after seed)

Follow your operating procedure:

1. Set all **QA-STRESS** captains active / online / available (test devices or simulators — not real fleets).
2. Run auto-distribution (or supervised manual assignment) across `QA-STRESS-*` orders only.
3. **BLOCK** the run if any captain receives an offer for **another company’s** order (`verify-readonly` also flags crossing rows in DB logs).
4. **COMPANY_ADMIN** isolation: three separate admin logins; each must **not** see other companies’ QA rows.
5. **SUPER_ADMIN** sees all QA companies/orders.
6. Deliver at least **30** orders **total** (minimum **3 per company**).
7. Exercise: **5** rejects, **5** expired offers, **5** reassignments, **5** cancellations (as per product capabilities).
8. **Earnings**: confirm settlement uses **delivery fee** basis, not product `amount`, for delivered QA orders.
9. **Reports + CSV**: totals match screen for the QA date window.
10. **i18n**: switch **ar / en / he** on main dashboard routes during the run; log gaps.

## Part D — Cleanup (after evidence archived)

Dry-run counts only:

```bash
QA_STRESS_CONFIRM=YES npx tsx scripts/qa-stress-cleanup.ts --dry-run
```

Apply deletes **only**:

- Orders whose **`order_number` starts with `QA-STRESS-`**, AND
- Companies whose name matches **`QA-STRESS-Company-NNN`**, AND only if **no non–QA-STRESS orders** exist on those companies.

```bash
QA_STRESS_CONFIRM=YES npx tsx scripts/qa-stress-cleanup.ts --apply
```

Writes `tmp/qa-stress-cleanup-preview.json`. Post-check prints remaining QA order/company counts.

**If cleanup would delete non-QA data, do not proceed** — gates abort when QA companies contain foreign orders or when QA-named orders attach to non-conforming companies.

## Shared naming rules

Defined in `apps/api/scripts/qa-stress-constants.ts` (`QA_STRESS_*_RE` regexes). Keep scripts and manual data aligned with those patterns.

## Final report template

Use stakeholder sections: **OVERALL LARGE QA STRESS TEST**, **CONFIG**, **SEED RESULT**, **VERIFY RESULT**, **DISPATCH RESULT**, **RBAC**, **FINANCIALS**, **I18N**, **CLEANUP**, **BLOCKING BUGS**, **FILES CHANGED**, **FINAL RECOMMENDATION**.

If **any wrong-company offer** reaches a captain or **any COMPANY_ADMIN sees another tenant**, mark **BLOCKED**.
