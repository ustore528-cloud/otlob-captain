# Phase 3.0 — Reports visibility & scoping (QA)

## Rules

- **Super Admin** (and legacy **ADMIN** with `reports.read` in web) — Reports nav + `/reports` route.
- **Company Admin** — no Reports in navigation; direct `/reports` redirects to home; API must reject with **403** (not tenant-scoped until product allows).

## Manual checks (dashboard + Network)

1. **Company Admin**
   - Confirm **no** "Reports" / التقارير item in the sidebar.
   - Open `…/reports` in the address bar — must redirect to `/` (or dashboard home), not render the reports page.
   - Optional: in DevTools, call any `GET /api/v1/reports/…` with the session — expect **403 Forbidden**.

2. **Super Admin**
   - Reports nav visible; `/reports` loads; report requests succeed (200) where data exists.

3. **Automation (local / CI, same DB as configured in `.env`)**

```bash
npx tsc -p apps/api/tsconfig.json --noEmit
npm run verify:phase0:tenant-negative -w @captain/api
```

- **Expected:** `phase0GatePass: true` when the database passes the negative gate (no spurious `missing_company_scope_users`, etc.).

## Backend reference

- `apps/api/src/rbac/permissions.ts` — `COMPANY_ADMIN.reports.read === false`.
- `apps/api/src/routes/v1/reports.routes.ts` — `requireRoles(...rolesWithCapability("reports.read"))`.

## Frontend reference

- `canAccessReportsPage` — `apps/web/src/lib/rbac-roles.ts` (uses `reports.read`; not granted to `COMPANY_ADMIN`).
- `reportsLoader` — `apps/web/src/router/loaders.ts` (redirects unauthorized roles).
