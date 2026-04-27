# Tenant Phase 0 Endpoint Scope Matrix

Generated: 2026-04-26T00:14:03.459Z

| Route File | Method | Path | authMiddleware | requireRoles | Scope Status |
|---|---|---|---|---|---|
| `src/routes/v1/activity.routes.ts` | `GET` | `/` | `yes` | `...ROLE_GROUPS.orderOperators` | `role_only_needs_review` |
| `src/routes/v1/auth.routes.ts` | `POST` | `/login` | `no` | `(none)` | `role_only_needs_review` |
| `src/routes/v1/auth.routes.ts` | `GET` | `/me` | `no` | `(none)` | `role_only_needs_review` |
| `src/routes/v1/auth.routes.ts` | `POST` | `/refresh` | `no` | `(none)` | `role_only_needs_review` |
| `src/routes/v1/auth.routes.ts` | `POST` | `/register` | `no` | `...ROLE_GROUPS.superAdmins` | `role_only_needs_review` |
| `src/routes/v1/branches.routes.ts` | `GET` | `/` | `yes` | `"SUPER_ADMIN", "COMPANY_ADMIN", "ADMIN", "BRANCH_MANAGER"` | `explicit_service_scope` |
| `src/routes/v1/captains.routes.ts` | `GET` | `/` | `yes` | `...captainsReadRoles` | `explicit_service_scope` |
| `src/routes/v1/captains.routes.ts` | `DELETE` | `/:id` | `yes` | `...captainsManageRoles` | `explicit_service_scope` |
| `src/routes/v1/captains.routes.ts` | `GET` | `/:id` | `yes` | `...captainsReadRoles, ...ROLE_GROUPS.captains` | `role_only_needs_review` |
| `src/routes/v1/captains.routes.ts` | `PATCH` | `/:id` | `yes` | `...captainsManageRoles, ...ROLE_GROUPS.captains` | `explicit_service_scope` |
| `src/routes/v1/captains.routes.ts` | `PATCH` | `/:id/active` | `yes` | `...captainsManageRoles` | `role_only_needs_review` |
| `src/routes/v1/captains.routes.ts` | `PATCH` | `/:id/availability` | `yes` | `...captainsReadRoles` | `explicit_service_scope` |
| `src/routes/v1/captains.routes.ts` | `GET` | `/:id/orders` | `yes` | `...captainsReadRoles` | `explicit_service_scope` |
| `src/routes/v1/captains.routes.ts` | `POST` | `/:id/prepaid-adjustment` | `yes` | `...captainsManageRoles` | `explicit_service_scope` |
| `src/routes/v1/captains.routes.ts` | `GET` | `/:id/prepaid-balance` | `yes` | `...ROLE_GROUPS.orderOperators, ...ROLE_GROUPS.captains` | `role_only_needs_review` |
| `src/routes/v1/captains.routes.ts` | `POST` | `/:id/prepaid-charge` | `yes` | `...captainsManageRoles` | `explicit_service_scope` |
| `src/routes/v1/captains.routes.ts` | `GET` | `/:id/prepaid-summary` | `yes` | `...ROLE_GROUPS.orderOperators, ...ROLE_GROUPS.captains` | `role_only_needs_review` |
| `src/routes/v1/captains.routes.ts` | `GET` | `/:id/prepaid-transactions` | `yes` | `...ROLE_GROUPS.orderOperators, ...ROLE_GROUPS.captains` | `role_only_needs_review` |
| `src/routes/v1/captains.routes.ts` | `GET` | `/:id/stats` | `yes` | `...captainsReadRoles, ...ROLE_GROUPS.captains` | `role_only_needs_review` |
| `src/routes/v1/captains.routes.ts` | `POST` | `/` | `yes` | `...captainsManageRoles` | `explicit_service_scope` |
| `src/routes/v1/captains.routes.ts` | `GET` | `/me` | `yes` | `...ROLE_GROUPS.captains` | `role_only_needs_review` |
| `src/routes/v1/captains.routes.ts` | `PATCH` | `/me/availability` | `yes` | `...ROLE_GROUPS.captains` | `role_only_needs_review` |
| `src/routes/v1/companies.routes.ts` | `GET` | `/` | `yes` | `(none)` | `role_only_needs_review` |
| `src/routes/v1/customer.routes.ts` | `GET` | `/orders` | `yes` | `"CUSTOMER"` | `role_only_needs_review` |
| `src/routes/v1/dashboard-settings.routes.ts` | `GET` | `/` | `yes` | `...ROLE_GROUPS.superAdmins` | `role_only_needs_review` |
| `src/routes/v1/dashboard-settings.routes.ts` | `PATCH` | `/` | `yes` | `...ROLE_GROUPS.superAdmins` | `role_only_needs_review` |
| `src/routes/v1/geocode.routes.ts` | `GET` | `/place` | `yes` | `...ROLE_GROUPS.orderOperators` | `role_only_needs_review` |
| `src/routes/v1/notifications.routes.ts` | `GET` | `/` | `yes` | `(none)` | `role_only_needs_review` |
| `src/routes/v1/notifications.routes.ts` | `PATCH` | `/:id/read` | `yes` | `(none)` | `role_only_needs_review` |
| `src/routes/v1/notifications.routes.ts` | `POST` | `/` | `yes` | `...ROLE_GROUPS.orderOperators` | `role_only_needs_review` |
| `src/routes/v1/notifications.routes.ts` | `POST` | `/quick-status` | `yes` | `...ROLE_GROUPS.orderOperators` | `role_only_needs_review` |
| `src/routes/v1/notifications.routes.ts` | `POST` | `/read-all` | `yes` | `(none)` | `role_only_needs_review` |
| `src/routes/v1/orders.routes.ts` | `GET` | `/` | `yes` | `...ordersReadRoles` | `explicit_service_scope` |
| `src/routes/v1/orders.routes.ts` | `GET` | `/:id` | `yes` | `...ordersReadRoles` | `explicit_service_scope` |
| `src/routes/v1/orders.routes.ts` | `POST` | `/:id/accept` | `yes` | `"CAPTAIN"` | `explicit_service_scope` |
| `src/routes/v1/orders.routes.ts` | `POST` | `/:id/admin-override-status` | `yes` | `...ordersDispatchRoles` | `explicit_service_scope` |
| `src/routes/v1/orders.routes.ts` | `POST` | `/:id/archive` | `yes` | `...ordersDispatchRoles` | `explicit_service_scope` |
| `src/routes/v1/orders.routes.ts` | `POST` | `/:id/distribution/auto` | `yes` | `...ordersDispatchRoles` | `explicit_service_scope` |
| `src/routes/v1/orders.routes.ts` | `POST` | `/:id/distribution/cancel-captain` | `yes` | `...ordersDispatchRoles` | `explicit_service_scope` |
| `src/routes/v1/orders.routes.ts` | `POST` | `/:id/distribution/drag-drop` | `yes` | `...ordersDispatchRoles` | `explicit_service_scope` |
| `src/routes/v1/orders.routes.ts` | `POST` | `/:id/distribution/manual` | `yes` | `...ordersDispatchRoles` | `explicit_service_scope` |
| `src/routes/v1/orders.routes.ts` | `POST` | `/:id/distribution/resend` | `yes` | `...ordersDispatchRoles` | `explicit_service_scope` |
| `src/routes/v1/orders.routes.ts` | `POST` | `/:id/override-status` | `yes` | `...ordersDispatchRoles` | `explicit_service_scope` |
| `src/routes/v1/orders.routes.ts` | `POST` | `/:id/reassign` | `yes` | `...ordersDispatchRoles` | `explicit_service_scope` |
| `src/routes/v1/orders.routes.ts` | `POST` | `/:id/reject` | `yes` | `"CAPTAIN"` | `explicit_service_scope` |
| `src/routes/v1/orders.routes.ts` | `PATCH` | `/:id/status` | `yes` | `...ordersReadRoles` | `explicit_service_scope` |
| `src/routes/v1/orders.routes.ts` | `POST` | `/:id/unarchive` | `yes` | `...ordersDispatchRoles` | `explicit_service_scope` |
| `src/routes/v1/orders.routes.ts` | `POST` | `/` | `yes` | `...ordersCreateRoles` | `explicit_service_scope` |
| `src/routes/v1/orders.routes.ts` | `POST` | `/distribution/auto-assign-visible` | `yes` | `...ordersDispatchRoles` | `explicit_service_scope` |
| `src/routes/v1/public.routes.ts` | `POST` | `/orders` | `no` | `(none)` | `role_only_needs_review` |
| `src/routes/v1/public.routes.ts` | `GET` | `/request-context/:code` | `no` | `(none)` | `role_only_needs_review` |
| `src/routes/v1/reports.routes.ts` | `GET` | `/delivered-commissions` | `yes` | `...reportsReadRoles` | `explicit_service_scope` |
| `src/routes/v1/reports.routes.ts` | `GET` | `/orders-history` | `yes` | `...reportsReadRoles` | `explicit_service_scope` |
| `src/routes/v1/reports.routes.ts` | `GET` | `/reconciliation-summary` | `yes` | `...reportsReadRoles` | `explicit_service_scope` |
| `src/routes/v1/stores.routes.ts` | `GET` | `/` | `yes` | `...ROLE_GROUPS.superAdmins` | `role_only_needs_review` |
| `src/routes/v1/stores.routes.ts` | `GET` | `/:id` | `yes` | `...ROLE_GROUPS.superAdmins` | `role_only_needs_review` |
| `src/routes/v1/stores.routes.ts` | `PATCH` | `/:id` | `yes` | `...ROLE_GROUPS.superAdmins` | `role_only_needs_review` |
| `src/routes/v1/stores.routes.ts` | `POST` | `/` | `yes` | `...ROLE_GROUPS.superAdmins` | `role_only_needs_review` |
| `src/routes/v1/super-admin-wallets.routes.ts` | `POST` | `/stores/:storeId/top-up` | `yes` | `(none)` | `role_only_needs_review` |
| `src/routes/v1/super-admin-wallets.routes.ts` | `POST` | `/supervisor-users/:userId/adjustment` | `yes` | `(none)` | `role_only_needs_review` |
| `src/routes/v1/super-admin-wallets.routes.ts` | `POST` | `/supervisor-users/:userId/top-up` | `yes` | `(none)` | `role_only_needs_review` |
| `src/routes/v1/supervisor-captain-transfer.routes.ts` | `POST` | `/transfers/to-captain` | `yes` | `(none)` | `role_only_needs_review` |
| `src/routes/v1/tracking.routes.ts` | `GET` | `/captains/active-map` | `yes` | `...dispatchTrackingRoles` | `explicit_service_scope` |
| `src/routes/v1/tracking.routes.ts` | `GET` | `/locations/latest` | `yes` | `...dispatchTrackingRoles` | `explicit_service_scope` |
| `src/routes/v1/tracking.routes.ts` | `POST` | `/me/location` | `yes` | `...ROLE_GROUPS.captains` | `explicit_service_scope` |
| `src/routes/v1/users.routes.ts` | `GET` | `/` | `yes` | `...ROLE_GROUPS.superAdmins` | `role_only_needs_review` |
| `src/routes/v1/users.routes.ts` | `GET` | `/:id` | `yes` | `(none)` | `role_only_needs_review` |
| `src/routes/v1/users.routes.ts` | `PATCH` | `/:id/active` | `yes` | `...ROLE_GROUPS.superAdmins` | `role_only_needs_review` |
| `src/routes/v1/users.routes.ts` | `PATCH` | `/:id/customer-profile` | `yes` | `...ROLE_GROUPS.orderOperators` | `role_only_needs_review` |
| `src/routes/v1/users.routes.ts` | `POST` | `/` | `yes` | `...ROLE_GROUPS.superAdmins` | `role_only_needs_review` |
| `src/routes/v1/wallet-read.routes.ts` | `GET` | `/captains/:captainId/wallet` | `yes` | `...captainBalanceRoles` | `explicit_service_scope` |
| `src/routes/v1/wallet-read.routes.ts` | `GET` | `/stores/:storeId/wallet` | `yes` | `...storeBalanceRoles` | `explicit_service_scope` |
| `src/routes/v1/wallet-read.routes.ts` | `GET` | `/wallet-accounts/:walletAccountId/ledger-activity` | `yes` | `...ledgerReadRoles` | `explicit_service_scope` |
| `src/routes/v1/wallet-read.routes.ts` | `GET` | `/wallet-accounts/:walletAccountId/ledger-entries` | `yes` | `...ledgerReadRoles` | `explicit_service_scope` |
| `src/routes/v1/wallet-read.routes.ts` | `GET` | `/wallets/supervisor/me` | `yes` | `...supervisorMeRoles` | `explicit_service_scope` |
| `src/routes/v1/zones.routes.ts` | `GET` | `/` | `yes` | `"SUPER_ADMIN", "COMPANY_ADMIN", "ADMIN", "BRANCH_MANAGER"` | `explicit_service_scope` |

## Notes
- `explicit_service_scope`: route family already maps to service-layer tenant scope checks and was prioritized in Phase 0 audit.
- `role_only_needs_review`: role gating exists, but endpoint still requires manual tenant-scope verification in next pass.