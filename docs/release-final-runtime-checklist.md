# Release Final Runtime Checklist (Pass / Fail)

Use this checklist for final release sign-off.  
Rule: mark each item as `PASS`, `FAIL`, or `NOT VERIFIED`.

## 1) Auth / Session / RBAC

- [ ] Login with phone and password succeeds for each role profile (`PASS/FAIL/NOT VERIFIED`).
- [ ] Invalid credentials show proper error, no broken state.
- [ ] Expired/invalid token triggers 401 handling and returns user to login.
- [ ] Route access by role is enforced on: `/orders`, `/distribution`, `/captains`, `/stores`, `/users`, `/finance`, `/reports`.
- [ ] API denies forbidden actions even if URL is forced manually.

## 2) Users (including Create User)

- [ ] `SUPER_ADMIN` sees create-user form and can submit successfully.
- [ ] Non-super-admin roles do **not** see create-user action.
- [ ] Toggle active/inactive works for allowed roles.
- [ ] Customer profile edit works and rejects non-customer targets correctly.

## 3) Orders / Assignment / Reassign

- [ ] Orders table loads with proper loading/empty/error states.
- [ ] Manual assign works from modal and updates list state.
- [ ] Reassign action appears only when order has assigned captain and eligible status.
- [ ] Reassign submit succeeds and updates order state.
- [ ] Resend and cancel-captain actions still work without regression.

## 4) Captains / Stores

- [ ] Captains list, edit modal, report modal load and handle errors correctly.
- [ ] Stores list renders with valid statuses/subscription/supervisor details.
- [ ] Empty/loading/error states are visible and clear in both pages.

## 5) Finance / Reports / Currency

- [ ] Finance balance and ledger views show currency consistently as ILS / `₪` where applicable.
- [ ] Captain prepaid displays use ILS-consistent labels.
- [ ] Reports commission and prepaid tables show ILS-consistent labels.
- [ ] Reconciliation summary endpoint returns successfully for default 7-day range.
- [ ] Reconciliation summary for a larger realistic range completes within acceptable response time.

## 6) Final Sign-off

- [ ] No P0 blockers remain open.
- [ ] All `FAIL` items resolved or waived in writing by product/ops owner.
- [ ] `NOT VERIFIED` items are explicitly listed in go/no-go decision.

---

### Execution metadata

- Environment:
- Date/time:
- Tester:
- Build/version:
- Final verdict (`GO` / `NO-GO`):
