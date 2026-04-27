# RBAC Two-Role Simplification QA Checklist

## Build

- [x] `npm run build -w @captain/shared` passed.
- [ ] `npm run build -w @captain/api` failed at Prisma engine rename step (Windows file lock):
  - `EPERM ... node_modules/.prisma/client/query_engine-windows.dll.node`
- [x] `npx tsc -p apps/api/tsconfig.json --noEmit` passed (API source typecheck).
- [x] `npm run build -w @captain/web` passed.

## Permission Matrix (Effective Active Model)

- `SUPER_ADMIN`: full access (users/captains/orders/dispatch/settings/reports/finance).
- `COMPANY_ADMIN`: limited to captain ownership scope and read-only scoped orders; no dispatch/settings/reports/global finance/users.
- `CAPTAIN`: preserved for mobile own-flow compatibility.
- Other non-active roles remain non-destructive in enum/data for compatibility, but hidden/deprecated from active UI model.

## Scope Enforcement

- Captain ownership field added: `captains.created_by_user_id`.
- COMPANY_ADMIN captain access now enforces ownership (`created_by_user_id == actor.id`), otherwise `403`.
- COMPANY_ADMIN order access now enforces ownership relation:
  - `order.createdByUserId == actor.id` OR
  - `order.assignedCaptain.createdByUserId == actor.id`
- COMPANY_ADMIN cannot access global wallet-read finance routes.

## Manual QA (Pending Runtime Execution)

### 1) SUPER_ADMIN
- [ ] full dashboard/routes visible
- [ ] create COMPANY_ADMIN works
- [ ] see all captains/orders
- [ ] charge any captain

### 2) COMPANY_ADMIN A
- [ ] create captain A1 from captains page
- [ ] list/detail only own captains
- [ ] charge A1 works
- [ ] users/settings/finance/reports/distribution hidden/blocked

### 3) COMPANY_ADMIN B
- [ ] create captain B1
- [ ] cannot view A1
- [ ] cannot charge A1
- [ ] cannot see A-owned orders

### 4) Orders isolation
- [ ] order tied to A scope visible to A
- [ ] same order hidden from B

### 5) Security checks
- [ ] direct API access to unrelated captain -> `403`
- [ ] direct API access to unrelated order -> `403`

## Notes

- No production deployment performed.
- Old enum roles were not hard-deleted.

