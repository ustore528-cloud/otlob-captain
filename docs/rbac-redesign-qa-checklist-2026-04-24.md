# RBAC Redesign QA Checklist (Preview / No Deploy)

## Build Verification

- [x] `npm run build -w @captain/shared` passed.
- [ ] `npm run build -w @captain/api` blocked by local Prisma engine file lock:
  - `EPERM: operation not permitted, rename ... node_modules/.prisma/client/query_engine-windows.dll.node.tmp...`
  - Notes:
    - This appears environmental (locked binary), not a TypeScript compile issue.
    - API typecheck still passed with `npx tsc -p apps/api/tsconfig.json --noEmit`.
- [x] `npm run build -w @captain/web` passed.

## Role Login Smoke

- [ ] SUPER_ADMIN login
- [ ] COMPANY_ADMIN login
- [ ] BRANCH_MANAGER login
- [ ] DISPATCHER login
- [ ] CAPTAIN_SUPERVISOR login
- [ ] STORE_USER login
- [ ] CAPTAIN mobile login

## Access Restrictions Smoke

- [ ] Users management visible only for allowed roles (super admin compatibility path).
- [ ] Dispatch dashboard restricted to dispatch-capable roles.
- [ ] Finance visibility aligned with finance-read capabilities.
- [ ] Reports visibility aligned with reports-read capabilities.
- [ ] Store user cannot access unrelated global management pages.

## Flow Smoke

- [ ] Create order as store-scoped role.
- [ ] Distribution assign/reassign/resend for dispatch-capable roles.
- [ ] Captain app assignment accept/reject/status flow.
- [ ] Finance read/write restrictions enforced.
- [ ] Reports data accessible only for permitted roles.
- [ ] No unexpected `401/403/500` for allowed actions.

## Static Compatibility Checks Completed

- [x] Captain mobile endpoint guard remains strict `CAPTAIN`:
  - `apps/api/src/routes/v1/mobile/captain-mobile.routes.ts`
- [x] Captain login role check remains unchanged:
  - `apps/api/src/services/auth.service.ts` (`loginCaptain` rejects non-CAPTAIN).
- [x] Transitional compatibility aliases added:
  - `STORE_ADMIN` treated as `STORE_USER` equivalent in RBAC helpers.
  - Legacy `ADMIN`/`STORE` capability compatibility retained.

## Release Gate

- No production deployment performed.
- Manual role-by-role runtime QA is still required before any release decision.

