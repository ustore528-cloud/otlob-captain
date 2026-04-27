# Tenant Isolation QA Checklist

## Purpose

Manual and API QA checklist for tenant-isolation verification before finance/company-wallet phases.

## Manual QA Checklist

### Super Admin global access

- [ ] Super Admin can view cross-company operational dashboards as expected.
- [ ] Super Admin quick-status global action works only when explicit global mode is used.
- [ ] Super Admin can join global socket operational room.

### Company Admin company-only access

- [ ] COMPANY_ADMIN can read/manage only own company orders.
- [ ] COMPANY_ADMIN cannot view or mutate another company resources.
- [ ] COMPANY_ADMIN quick-status reaches own-company captains only.

### Store Admin company/store access

- [ ] STORE_ADMIN can only operate within own scoped store/company.
- [ ] STORE_ADMIN cannot create/update orders for outside stores.

### Captain mobile assignment visibility

- [ ] Captain sees only orders in own company/branch scope per assignment rules.
- [ ] Captain does not receive cross-company assignment updates.

### Quick-status notification scoping

- [ ] Non-super quick-status fanout remains tenant-scoped.
- [ ] Captains in other companies do not receive the alert.

### Socket live updates scoping

- [ ] Company A user can join Company A room.
- [ ] Company A user cannot join Company B room.
- [ ] Missing company scope user is denied company room join (`TENANT_SCOPE_REQUIRED`).
- [ ] Super Admin global + company room join behavior matches policy.

### Order create tenant derivation

- [ ] Order create derives `companyId` and `branchId` from selected store.
- [ ] Frontend-injected `companyId` / `branchId` cannot override store-derived tenant values.

### Order update tenant derivation

- [ ] Direct tenant override without store change is rejected/ignored per guardrail.
- [ ] Store change recalculates `companyId` + `branchId` from new store.
- [ ] No manual tenant override can bypass store-derived recalculation.

### Reports/dashboard scoping

- [ ] Reports and dashboard views are limited to user tenant scope for non-super users.
- [ ] No cross-company rows are visible for scoped roles.

## API Negative Tests

- [ ] Company A cannot read Company B orders.
- [ ] Company A cannot assign to Company B captain.
- [ ] Company A cannot quick-status broadcast to Company B captains.
- [ ] Company A cannot join Company B socket room.
- [ ] Non-super user cannot inject `companyId` / `branchId` to bypass tenant derivation.

## Known Exceptions (Approved)

Do not modify until operationally safe:

- `cmocbided0001umq8jqn51amv` (`PENDING` branch drift row)
- `cmocbh7tr0001um7whnyvpuh9` (`PENDING` branch drift row)

## QA Evidence to Attach

- Output of:
  - `npm run audit:phase0:missing-tenant-scope`
  - `npm run audit:phase0:order-store-mismatch`
  - `npm run audit:phase0:global-fanout-risks`
  - `npm run verify:phase0:tenant-negative`
  - `npx tsc -p tsconfig.json`
- Output of verification scripts:
  - `phase171:verify-order-tenant-injection-guards`
  - `phase18:verify-socket-tenant-rooms`

## Sign-Off

- [ ] Engineering sign-off
- [ ] QA sign-off
- [ ] Product/Operations acknowledgment of deferred Lane B exception handling
