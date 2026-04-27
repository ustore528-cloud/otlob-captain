# Tenant Isolation Closure

## Scope

This document closes the tenant-isolation hardening track and records current release-gate status before finance/company-wallet phases.

## Completed Phases

- Phase 0 audit
- Phase 0.5 backfill proposal
- Phase 0.6 STORE_ADMIN `companyId` backfill
- Phase 0.7 BRANCH_MANAGER review
- Phase 0.8 BRANCH_MANAGER deactivation
- Phase 1 quick-status tenant fanout fix
- Phase 1.5 branch drift review
- Phase 1.6 delivered branch drift apply
- Phase 1.7 runtime branch drift prevention
- Phase 1.7.1 tenant injection verification
- Phase 1.8 socket tenant room hardening

## Current Audit State

- `missingCompanyScope = 0`
- `missingBranchScope = 0`
- `global fanout riskCount = 0`
- `verify:phase0:tenant-negative = true`
- `order/store branch drift = 2` (pending rows only; see known exceptions)

## Security Rules Enforced

- Non-Super-Admin tenant scope is required for scoped operations.
- COMPANY_ADMIN quick-status fanout cannot reach captains outside own company.
- Socket room joins are tenant-scoped and blocked for cross-company joins.
- Order tenant values derive from store tenant values.
- Frontend `companyId` / `branchId` injection cannot override backend tenant derivation.

## Remaining Known Exceptions

### Lane B deferred order/store branch drift rows

The following two `PENDING` rows are intentionally deferred for operational safety and must not be auto-mutated:

- `cmocbided0001umq8jqn51amv`
- `cmocbh7tr0001um7whnyvpuh9`

### Windows Prisma build lock

Local Windows full build may fail intermittently with Prisma engine file lock (`EPERM` rename on `query_engine-windows.dll.node`). This is an environment/runtime lock issue, not a TypeScript correctness failure.

## Rollback Notes By Phase

- Phase 0.6 (`STORE_ADMIN` company scope backfill): rollback by restoring prior `users.company_id` values for the approved allowlist only.
- Phase 0.8 (`BRANCH_MANAGER` deactivation): rollback by setting `isActive=true` only for the two approved users.
- Phase 1 (quick-status fanout): rollback by reverting quick-status service/controller scoping changes.
- Phase 1.6 (delivered branch drift apply): rollback by restoring prior `orders.branch_id` for the two Lane A delivered rows only.
- Phase 1.7 / 1.7.1 (order tenant derivation and verification): rollback by reverting repository/service guard changes and verification script additions.
- Phase 1.8 (socket tenant scoping): rollback by reverting socket auth/room helper changes and associated verification/audit script updates.

All rollback actions must be done with explicit allowlists and post-change audit verification.

## Release Gate Status

- No production deploy has occurred in this tenant-isolation track.
- No APK publish has occurred in this tenant-isolation track.
- Production release remains gated on:
  - full build in a clean environment (without Prisma lock interference)
  - final manual QA sign-off
  - approval of deferred Lane B operational handling

## Recommended Next Phase

Proceed to finance/company-wallet phases with tenant isolation baselines frozen:

1. Keep Phase 0 audits + negative verifier in pre-merge checks.
2. Maintain explicit allowlist + dry-run/apply pattern for any data mutation scripts.
3. Treat Lane B rows as operational exceptions until a dedicated safety plan is approved.
