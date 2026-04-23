# PRD implementation roadmap (§1–§16)

**Status:** planning artifact — work proceeds in **preview/staging** only until explicit approval (§14–§16).

**Current baseline (repo today):** multi-tenant foundation (Company/Branch/Store/Captain/Order), Phase 2 RBAC, captain prepaid/ledger rows (`CaptainBalanceTransaction`), `ActivityLog`, distribution/dispatch, web dashboard, captain mobile. **Phase A (DB):** `Region` + optional `Store.primaryRegionId` + migration `20260423210000_phase_a_region_store_primary`. **Phase B1 (DB):** `StoreSubscriptionType` + `Store.supervisorUserId` + migration `20260424120000_phase_b1_store_subscription_type` (default `PUBLIC`; no order-scoping yet). **Phase B2 (API only):** store create/update + Zod + `assertStoreSupervisorLinkValid` (company/branch/role rules); store responses include `supervisorUser` summary. **Phase B3 (read metadata):** `store.subscriptionType` + `store.supervisorUser` on order read payloads (list/detail/mobile/distribution `orderInclude`); no new filtering. **Phase B4 (API+DB, captain supervisor):** optional `Captain.supervisorUserId` + `assertOptionalCaptainSupervisorLinkValid` (same company/branch/role rules as store supervisor); read `supervisorUser` on captain payloads; migration `20260424140000_phase_b4_captain_supervisor`; no distribution or visibility changes. **Phase A completion (read metadata):** optional `store.primaryRegion` summary `{ id, code, name, isActive }` on store read APIs and on order-embedded `store` (and captain assignment overflow `storePrimaryRegion`); no new migration; no region filters. **Supervisor read scoping (staff orders):** `BRANCH_MANAGER` + `DISPATCHER` with supervised `SUPERVISOR_LINKED` stores and/or supervised captains see only those orders in list + `getById` (OR of store or assigned captain); `COMPANY_ADMIN` / `SUPER_ADMIN` / legacy `ADMIN` bypass; `assertStaffCanAccessOrder` for writes/distribution unchanged. **Not yet built** vs the PRD: map UI, point-in-polygon dispatch, store/supervisor wallets, subscription modes, full unified ledger, order-event timeline service, store web portal, PDF engine, super-admin domain pages 10.1–10.11 as specified.

## Guiding rules (from §13–§16)

- Additive schema first; no destructive table swaps without a reviewed two-phase plan.
- No silent changes to the existing order/dispatch golden path: new behavior behind flags or new code paths where needed.
- Every money movement: append-only ledger + idempotency (§4–§6, §12).
- Captain/store visibility: enforced **server-side** (§7, §9).
- Production only after: preview build, checklist (§14D), sign-off (§16).

## Phased delivery (recommended order)

| Phase | Scope | PRD sections | Primary outputs |
|-------|--------|--------------|-----------------|
| **A** | **Region model + map** | §7, §8, parts of §10.1, §10.11 | `Region` (code, name, parent, polygon GeoJSON or PostGIS, status), link tables (store↔region, captain↔region), optional `nearby_zone` config; store requires lat/lng + primary region before `operational` flag |
| **B** | **Subscription modes** | §2, §8, parts of §10.2, §10.11 | Enum `PUBLIC` / `SUPERVISOR_LINKED` on store; optional `supervisorUserId` (or `SupervisorProfile` id); scoping rules for order lists |
| **C** | **Supervisor role + wallet inflow** | §3.2, §5, §10.3, §10.7 | `UserRole` or parallel `Supervisor` entity + wallet account; SA→supervisor top-up; transfer to captains in scope; ledger |
| **D** | **Store wallet + delivered-only charge** | §3.3–§4, §10.6, §6 | `Store` wallet account; single idempotent `ORDER_DELIVERED` debit; no charge on create/accept/pickup/in-transit |
| **E** | **Unified ledger + order audit stream** | §12, §10.9 | `LedgerEntry` (or domain-specific tables) for all event types; order timeline table/index on existing flows |
| **F** | **Store web portal** | §3.3, §3.4, §8 | Separate routes/build or route prefix; PII gating for captain name/phone post-acceptance |
| **G** | **Region dispatch + captain visibility** | §7, §9 | Point-in-polygon + scope + subscription filter on available orders; align mobile/web |
| **H** | **PDF reporting** | §11, §10.10 | Server-side render job; filter metadata in PDF; export audit log |
| **I** | **Super Admin pages** | §10 | Implement pages 10.1–10.11 incrementally, read-only first where high-risk |

## First safe migration (Phase A) — design sketch

- **Add** `regions` + `region_closure` or `parentId` for tree; `region_geometries` or single `boundaryGeoJson` column (validate size).
- **Add** optional `store.primary_region_id`, `store.is_operationally_ready` (or compute from `latitude/longitude/primary_region_id`).
- **Backfill:** existing stores: set primary region to a default per branch/area or a single “legacy” region row — must be a **data migration script**, not silent prod overwrite without preview QA.

## Test checklist (minimum before any production) — from §14D

- Regression on existing features; store order create; captain accept; **region scoping**; **delivered-only** store charge; **supervisor transfer**; **SA store top-up**; **region mapping**; **PDFs**; **no duplicate deductions**; **no cross-scope leakage**.

## Explicit non-goals until earlier phases are stable

- Broad refactors of distribution engine unrelated to region scope.
- Replacing `CaptainBalanceTransaction` in one shot (migrate toward unified `LedgerEntry` in Phase E with backfill, not a drop).

---

*This file is the working map for PRD §15–16; update phase status as slices merge to `main` and are validated in preview.*
