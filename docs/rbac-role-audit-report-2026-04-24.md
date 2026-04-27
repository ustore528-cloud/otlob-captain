# RBAC Role Audit Report (2026-04-24)

## Current Enum Roles

Source of truth:
- `apps/api/prisma/schema.prisma`
- `packages/shared/src/enums.ts`

Current persisted roles:
- `SUPER_ADMIN`
- `COMPANY_ADMIN`
- `BRANCH_MANAGER`
- `STORE_ADMIN`
- `DISPATCHER`
- `CAPTAIN`
- `CUSTOMER`

Legacy compatibility roles still handled in code:
- `ADMIN` (legacy token/data compatibility)
- `STORE` (legacy token/data compatibility)

## Where Roles Are Enforced (API)

Primary guard layer:
- `apps/api/src/middlewares/rbac.middleware.ts` (`requireRoles`)
- `apps/api/src/lib/rbac-roles.ts` (role groups + helper predicates)
- `apps/api/src/middlewares/auth.middleware.ts` (JWT payload -> `req.user.role`)

Role-dependent route groups:
- Users: `apps/api/src/routes/v1/users.routes.ts`
  - list/create: `SUPER_ADMIN`
  - set active: management admins
- Orders/Dispatch: `apps/api/src/routes/v1/orders.routes.ts`
  - operations depend on `orderOperators`, `storeAdmins`, `captains`
- Captains: `apps/api/src/routes/v1/captains.routes.ts`
  - management + captain self-access split
- Stores: `apps/api/src/routes/v1/stores.routes.ts`
  - management/dispatcher/store role split
- Tracking: `apps/api/src/routes/v1/tracking.routes.ts`
  - staff map visibility vs captain location write
- Finance read/write:
  - `apps/api/src/routes/v1/wallet-read.routes.ts`
  - `apps/api/src/routes/v1/super-admin-wallets.routes.ts`
  - `apps/api/src/routes/v1/supervisor-captain-transfer.routes.ts`
- Reports: `apps/api/src/routes/v1/reports.routes.ts`
- Mobile captain endpoints: `apps/api/src/routes/v1/mobile/captain-mobile.routes.ts` (strict `CAPTAIN`)
- Customer endpoints: `apps/api/src/routes/v1/customer.routes.ts` (strict `CUSTOMER`)

## Tenant Scope Enforcement

Primary scope service:
- `apps/api/src/services/tenant-scope.service.ts`

Observed scope model:
- `SUPER_ADMIN` can resolve to unscoped access.
- Scoped staff (`COMPANY_ADMIN`, `BRANCH_MANAGER`, `DISPATCHER`, plus legacy admin path) are filtered by `companyId`/`branchId`.
- Store/captain/order access checks reuse the same tenant filter logic in service methods.

## Web Role Dependencies

Shared role-check helpers:
- `apps/web/src/lib/rbac-roles.ts`

Route/page gating:
- `apps/web/src/layouts/dashboard-layout.tsx`
- `apps/web/src/router/loaders.ts`
- `apps/web/src/router.tsx`

Feature-level checks:
- Users:
  - `apps/web/src/features/users/users-page.tsx`
  - `apps/web/src/features/users/constants.ts`
  - `apps/web/src/features/users/components/add-user-form-card.tsx`
- Distribution:
  - `apps/web/src/features/distribution/distribution-page.tsx`
- Finance:
  - `apps/web/src/features/finance/finance-page-view.tsx`
- Reports:
  - `apps/web/src/features/reports/reports-page-view.tsx`
- Stores:
  - `apps/web/src/features/stores/stores-page-view.tsx`

Current web role labels:
- `apps/web/src/lib/user-role.ts`

## Captain Mobile Role Dependencies

Role assumptions and auth payload:
- `apps/captain-mobile/src/types/auth.ts`
- `apps/captain-mobile/src/store/auth-store.ts`
- `apps/captain-mobile/src/services/api/dto/auth.dto.ts`

Server-side captain guard:
- `apps/api/src/routes/v1/mobile/captain-mobile.routes.ts` (`requireRoles("CAPTAIN")`)

Risk note:
- Captain app flow is tightly coupled to `CAPTAIN` role and must remain unchanged during redesign.

## Existing Safe Migration Baseline

Already applied migration:
- `apps/api/prisma/migrations/20260423193000_phase2_rbac_roles_hierarchy/migration.sql`

What it does:
- Maps legacy `STORE -> STORE_ADMIN`
- Maps legacy `ADMIN -> SUPER_ADMIN|COMPANY_ADMIN|BRANCH_MANAGER` using scope columns

## Mapping and Deprecation Strategy (This Redesign)

Target new roles:
- `CAPTAIN_SUPERVISOR`
- `STORE_USER`

Safe transition mapping:
- `STORE_ADMIN` -> `STORE_USER` (idempotent mapping script + compatibility alias in code)
- keep legacy `ADMIN`/`STORE` runtime compatibility until no references remain
- keep `CUSTOMER` active but marked deprecated for this rollout (no removal now)

## Old Role Status

- `ADMIN`: deprecated compatibility-only; remove later after JWT/data cleanup
- `STORE`: deprecated compatibility-only; remove later after JWT/data cleanup
- `STORE_ADMIN`: transitional; mapped to `STORE_USER` while kept temporarily for compatibility
- `CUSTOMER`: active but deprecated for future product decision

## High-Risk Flows to Protect

- Login/JWT payload generation (`apps/api/src/services/auth.service.ts`, `apps/api/src/lib/jwt.ts`)
- Dashboard route visibility (`apps/web/src/layouts/dashboard-layout.tsx`)
- Distribution and order assignment (`apps/api/src/routes/v1/orders.routes.ts`, web distribution page)
- Finance and reports visibility/authorization (`apps/api/src/routes/v1/wallet-read.routes.ts`, `apps/api/src/routes/v1/reports.routes.ts`)
- Captain mobile authentication + assignment lifecycle

