# RBAC Simplification Audit (Two Active Roles)

## Scope audited
- `apps/api/src/rbac/permissions.ts`
- `apps/api/src/lib/rbac-roles.ts`
- `apps/api/src/routes/v1/users.routes.ts`
- `apps/api/src/routes/v1/captains.routes.ts`
- `apps/api/src/routes/v1/orders.routes.ts`
- `apps/api/src/routes/v1/wallet-read.routes.ts`
- `apps/api/src/services/wallet-read-access.service.ts`
- `apps/api/src/services/tenant-scope.service.ts`
- `apps/api/prisma/schema.prisma`
- `apps/web/src/lib/rbac-roles.ts`
- `apps/web/src/lib/user-role.ts`
- `apps/web/src/features/users/constants.ts`
- `apps/web/src/features/captains/**`
- `apps/web/src/features/finance/**`
- `apps/web/src/features/orders/**`

## Findings: where COMPANY_ADMIN had too much access

- `apps/api/src/rbac/permissions.ts`
  - `COMPANY_ADMIN` previously had `orders.dispatch`, `reports.read`, `settings.read`, and finance/store capabilities beyond target.

- `apps/api/src/routes/v1/users.routes.ts`
  - Access was capability-derived and allowed non-superadmin patterns in prior matrix usage.

- `apps/api/src/routes/v1/stores.routes.ts`
  - COMPANY_ADMIN and other non-super roles could read/manage stores globally within tenant scope, conflicting with new minimal model.

- `apps/api/src/routes/v1/tracking.routes.ts`
  - Tracking map endpoints were allowed for broad `orderOperators`, effectively exposing dispatch map for COMPANY_ADMIN.

- `apps/api/src/services/captains.service.ts`
  - COMPANY_ADMIN access was company/branch scoped only; no hard owner isolation by creator.

- `apps/api/src/services/orders.service.ts`
  - COMPANY_ADMIN order visibility relied on company/branch scope; no strict ownership filter to prevent cross-admin visibility within same company.

- `apps/api/src/services/wallet-read-access.service.ts` and `apps/api/src/routes/v1/wallet-read.routes.ts`
  - COMPANY_ADMIN could read wallet routes intended for broader finance dashboards.

- `apps/web/src/lib/rbac-roles.ts`
  - COMPANY_ADMIN was treated as dispatch-capable and had finance/report/incubator visibility in UI.

- `apps/web/src/features/users/constants.ts`
  - User creation UI exposed many non-target roles for new users.

## Applied simplification direction

- Active UI/staff model reduced to:
  - `SUPER_ADMIN`
  - `COMPANY_ADMIN`
- Non-destructive compatibility kept in enum/data.
- Captain mobile `CAPTAIN` flow preserved.
- Added captain ownership field (`captains.created_by_user_id`) for strict COMPANY_ADMIN isolation.
