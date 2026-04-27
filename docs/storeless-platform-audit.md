# Storeless platform migration — Phase S0 dependency audit (read-only)

**Date:** 2026-04-26  
**Scope:** Audit only. No code changes, no DB writes, no migrations, no deploy, no APK.  
**Product goal (future):** Expose **Company → Captains → Orders → Distribution**; stop presenting **Stores** as a user-facing product while keeping a **compatibility layer** for existing `storeId` data and APIs.

---

## 1. Files and areas inspected (sample + systematic search)

| Area | How inspected |
|------|----------------|
| `apps/api/prisma/schema.prisma` | `Order`, `Store`, `WalletAccount`, `User`, relations |
| `apps/api/src/services/orders.service.ts` | Order create, tenant, store resolution |
| `apps/api/src/repositories/order.repository.ts`, `order-store-enrichment.ts` | List/detail include store |
| `apps/api/src/validators/orders.schemas.ts` | `storeId` on create / list |
| `apps/api/src/dto/order.dto.ts` | Store summary on order payloads |
| `apps/api/src/services/*` (distribution, reports, finance, wallet, tenant, captain-mobile) | `rg storeId\|Store` over `apps/api/src` |
| `apps/api/src/routes/v1/*.ts` | `stores.routes`, `wallet-read`, orders |
| `apps/web/src` | `rg` store/Store; key pages: router, layout, finance, orders, new-order, distribution, reports, stores |
| `apps/captain-mobile/src` | `rg` store/storeId/pickup/merchant for captain UI |
| `packages/shared/src` | `api-paths`, `order-financial-inference`, `auth` schema |
| `apps/captain-mobile/android` | Only boilerplate `MainActivity` / `MainApplication` (no business store UI in Kotlin) |

*Full file-level hits: dozens of files; the sections below group dependencies by concern.*

---

## 2. Backend store dependencies (summary)

### 2.1 Orders (create / update / list / detail)

- **Prisma:** `Order.storeId` is **required** (non-nullable `String`); `Order` → `Store` relation **required** (`onDelete: Restrict`). Index `@@index([storeId, status])`.
- **`CreateOrderBodySchema`:** `storeId` **optional** on API; comment states `companyId`/`branchId` on body are **ignored**; tenant is derived from **store**.
- **`ordersService.create`:** Resolves `storeId` by role:
  - **STORE_*** roles: forced to `actor.storeId`.
  - **Order operators** (`COMPANY_ADMIN`, dispatchers, etc.): if no `storeId`, loads **first active** `Store` for tenant; if **none**, creates a synthetic row **`متجر التشغيل`** (“operational store”) on the default branch, connected to `actor.userId` as owner — then uses that `storeId`. This is an existing **compatibility / hidden-store** path.
  - Fails with `400` + `storeId is required` only if no resolution path (e.g. no store and not an operator with tenant).
- **List/detail:** Repository and DTOs **enrich** orders with `store` (or store summary) for clients (`order-store-enrichment`, `toOrderDetailDto` / list DTOs). Financial copy still refers to “store amount” in shared inference docs.

### 2.2 Distribution

- **Engine / supervisor scope:** Uses **order** + **company** + **captain** alignment; store may appear in enrichment or supervisor helpers (`supervisor-order-scope`, `supervisor-order-read-scope`). Core assignment is **company/captain/order**, not store UI.

### 2.3 Finance & wallet / ledger

- **Wallet read routes / services:** `storeId` in paths and access checks (`wallet-read`, `WalletOwnerType.STORE`, company admin store top-up).
- **Transfer / top-up services:** `INSUFFICIENT_COMPANY_BALANCE` and flows reference **store** wallets where owner is `STORE`.
- **Super Admin:** company wallet + **store** wallet top-up endpoints in paths (`super-admin-wallets`, `api-paths`).

### 2.4 Reports

- `reports.service` / controller / schemas: filters and DTOs can reference **store** for history / export where orders expose store.

### 2.5 Dashboard & settings

- Dashboard stats / hooks (web) may count or label store-related data; not a hard server “Store” product API beyond existing order/store joins.

### 2.6 Tenant derivation

- **Orders:** Tenant from **store** row (`companyId`, `branchId`) after `store` is chosen or created.
- **JWT** (`lib/jwt.ts`): payload includes `storeId` (for store-owned users) plus `companyId` / `branchId`.
- **`tenant-scope.service`**, **supervisor order read** libs: use **order.companyId** / **branch** / **owner**; align with `store` only where order-store consistency is checked.

### 2.7 Captain mobile assignment payload

- **API DTOs** (`order.dto.ts`): `StoreSummaryDto` on orders; captain mobile consumers read **enriched** order JSON.
- **`captain-mobile.service.ts`** (API): part of order push / mobile payload shaping (touched in search).

### 2.8 Shared DTOs / contracts

- **`@captain/shared`:** `order-financial-inference` uses the word “store” for the **merchandise line** (`amount` / `payToStore`); that is **domain language**, not necessarily the `Store` entity, but UI copy may still say “store”.
- **`api-paths`:** `stores.*`, `finance/stores/:id`, `super-admin/.../stores/.../top-up`, etc.

### 2.9 Prisma / repositories

- `store.repository.ts`, `stores.service.ts`, `stores.controller`, `stores.routes` — full CRUD/list API surface.
- `user.repository` / `auth`: can relate users to `ownedStores`, `storeId` on token for store roles.

### 2.10 Other

- `company-archive.service` counts **stores** in dependency preview.
- `public-request` / order creation from public code: paths tied to company/admin; may still end on orders with a resolved store.

---

## 3. Web (dashboard) store dependencies (summary)

### 3.1 Navigation

- **`router.tsx`:** Route `stores` → `StoresPage` + `storesLoader`.
- **`dashboard-layout.tsx`:** `canStoresNav = isDispatch && !isCompanyAdmin` — **DISPATCHER**-style roles get **Stores** nav; **Company Admin** does not (already partially hidden for CA).
- **`dashboard-sidebar.tsx`:** “Stores” link when `nav.canStores` (driven from layout flags).

### 3.2 Finance page

- **`finance-page-view.tsx`:** Tab model includes **`store`** (supervisor / store / captain / company), `useStores`, `SuperAdminStoreTopupModal`, `CompanyAdminStoreTopupModal`, store wallet API calls, etc.

### 3.3 Users page

- **Super Admin company archive modal** — dependency **counts** include `storesCount` (read-only for archive preview), not a “manage stores” workflow.

### 3.4 Orders

- **List / detail** components reference **store** on order (name, id) for display and filters.
- **List query** can pass `storeId` (API) where supported.

### 3.5 Order create (`new-order-form.tsx`)

- **Store Admin:** `lockedStoreId` from `user.storeId` when creating.
- **Company Admin / dispatch:** no mandatory store picker in the scanned portion; create payload may omit `storeId` and rely on **server auto-resolution** (and possible **operational store** create).

### 3.6 Distribution

- `distribution-page.tsx` / `distribution-map.tsx` / `supervisor-assign-ui` — order-centric; any “store” mention is for labels or order payload fields.

### 3.7 Reports

- `reports-page-view` and CSV utils reference store-related fields where exports mirror order data.

### 3.8 Settings

- `use-dashboard-settings` and stats may indirectly relate; primary store surface is **Finance** and **Stores** page.

### 3.9 API clients / hooks

- `lib/api/services/stores.ts`, `hooks/stores/*`, `client.ts` `stores` methods, `queryKeys.stores`, `add-captain` / `captain` forms may use company + branch + **store** pickers (e.g. smoke flows).

### 3.10 Auth / state

- Web auth store (Zustand) filename `auth-store` — not the **Store** entity; ignore naming collision.

---

## 4. Mobile (captain app) store dependencies (summary)

- **`order-detail-content.tsx`:** Renders `order.store.name`, `order.store.area`, `orderDetail.storeLine`, section “restaurant” / **store** icon; pickup from `order.pickupAddress` with “hint from store”.
- **`captain-order-list-card.tsx` / workbench:** `item.store?.name`, `merchantName` from `order.store`, labels `workbench.store`, `money.storeAmount` in strings.
- **`use-captain-assignment-workbench.tsx`:** Bundles `storeName`, `order.store` for UI.
- **i18n:** keys for pickup, store, store amount — product language still “store/merchant” in places.
- **State management:** `auth-store` / `in-app-top-banner-store` are **Zustand**, not DB Store.

*Native Android layer:* only `MainActivity` / `MainApplication` in search — **no** additional store business logic in Kotlin in the paths scanned.

---

## 5. DB / schema constraints (answers to audit items 4–6)

| Question | Finding |
|----------|--------|
| **Is `Order.storeId` required?** | **Yes.** Schema: `storeId String` **non-optional**; FK to `Store`. |
| **Does `Company` alone suffice to create orders?** | **Not in schema alone.** `Order` needs `companyId`, `branchId`, and **`storeId`**. In **application logic**, `ordersService.create` can **create** a hidden “operational” `Store` and a branch is required; so **runtime** can bootstrap a store for operators without user picking a store. |
| **Does every company have at least one `Store` row?** | **Not guaranteed in schema.** A new company can exist with **zero** stores until first qualifying order (or manual seed) creates “متجر التشغيل” or seed data. **S0 does not run SQL**; recommend a one-off **read-only** query in a later phase: `companies` left join `stores` counts. |

---

## 6. Risk map (high level)

| Risk | Mitigation (future phases, not in S0) |
|------|----------------------------------------|
| Dropping or nulling `Order.storeId` | **Do not** until migrations + backfill; breaks FK, reports, wallet lines. |
| Hiding all store APIs at once | Breaks web/mobile that still read store summaries; use **read compatibility** and gradual UI removal. |
| Company with no store + bug in create path | Order create could fail before operational-store branch; test **greenfield** company on staging. |
| Finance store wallets & ledger | Historical **ledger** rows tied to `WalletAccount` **STORE** must remain valid; do not remove store wallet tables in phase 1. |
| COPY / i18n “store” in shared financial inference | Renaming to “merchant/line items” is **cosmetic** but touches many labels; separate copy phase. |
| Mobile depends on `order.store` object | Hiding product “Store” still needs **synthetic** or **denormalized** display (e.g. company name) if `store` is removed from DTO. |

---

## 7. Recommended phased migration (after S0)

1. **S1 — UI / copy only (no API removal):** Hide Stores nav (except where policy wants dispatch tools), de-emphasize store tabs in Finance, reword “store” to “merchant”/“company” where safe; keep APIs.
2. **S2 — Order creation defaults:** Make **company-level** UX explicit: single internal default store / “operational store” (already partially implemented server-side); optional admin flag `company.defaultStoreId` (future) to avoid ad-hoc `findFirst`.
3. **S3 — DTOs:** For mobile/web, add **companyDisplayName** and reduce reliance on `store` in list cards; keep `store` in JSON for compatibility until **S4+**.
4. **S4 — Schema (optional, late):** Nullable `storeId` + backfill only with strong migration plan — **out of scope** for first compatibility phase per product note.

---

## 8. What can be hidden **immediately** (UI-only; with QA)

*Assuming no behavior change in APIs — only navigation and tab visibility. Must be feature-flagged or role-checked and regression-tested.*

- **Stores** sidebar entry for **Super Admin / dispatcher** (currently shown when `canStores` is true) if product wants “no store module” for those roles.
- **Finance** “store” sub-tab, **Super Admin store top-up** and **Company Admin store top-up** modals — replace narrative with “legacy wallet” or hide behind “advanced”.
- **Order list / detail** optional **store** column and filter — can be hidden in favor of company/area.
- **Reports** export columns that duplicate store when company is enough.

*Do not remove routes without redirects if bookmarks exist; use guard or empty state with explanation.*

---

## 9. What must remain (compatibility, first phases)

- **`Store` table and all `storeId` FKs** on orders, etc.
- **All existing REST routes** under `/stores`, store wallet, store top-up, until consumers are migrated.
- **Ledger and wallet** rows for `WalletOwnerType.STORE`.
- **Order list/detail** API responses that include `store` for old clients.
- **Mobile** `order.store` **until** API supplies an alternative and apps ship.
- **Server logic** in `ordersService.create` that **creates** `متجر التشغيل` / picks first store — this is the current **safety net**; document for operators.

### Legacy-only / “Super Admin inspection”

- **Super Admin** may still need **read** access to store wallets and dependency counts (archive preview) for support — treat as **internal tools**, not primary workflow.

---

## 10. Confirmation: no code or data changes in S0

- This document is the only deliverable of Phase S0.  
- **No** application source edits, **no** migrations, **no** `prisma` writes, **no** production or APK actions were performed as part of this audit.

---

## Appendix A — Notable code reference (order create / hidden store)

The backend may **create** a synthetic store when an operator has tenant but no store exists: service uses `prisma.store.create` with a fixed display name and connects company, branch, and `owner` to the actor. This satisfies **compatibility** without the user ever typing a `storeId` in the new **Company Admin** flows.

---

## Appendix B — Suggested read-only data check (not run in S0)

```sql
-- Example: companies with zero stores (PostgreSQL)
SELECT c.id, c.name
FROM companies c
LEFT JOIN stores s ON s.company_id = c.id
GROUP BY c.id, c.name
HAVING COUNT(s.id) = 0;
```

Run in a **maintenance / staging** window when moving past S0.
