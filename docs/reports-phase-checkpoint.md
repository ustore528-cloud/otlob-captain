# Finance ledger activity — reports phase checkpoint (stable)

> Recorded **2026-04-24** as a **stable** baseline after Slices 1–3 (API, UI, CSV) were accepted, verified, and closed.  
> This snapshot does **not** start or commit to the next reporting slice; wait for product instruction.

## Verification status (recorded)

| Item | Result |
|------|--------|
| Ledger activity report API | PASS |
| Ledger activity report UI | PASS |
| Ledger activity CSV export (client-side) | PASS |
| Web / shared build | PASS |
| Deploy | Not required; none performed |
| Rollback | Not needed |

## What this phase includes (scope)

- **API — `GET /api/v1/finance/wallet-accounts/:walletAccountId/ledger-activity`**  
  - Query: `from`, `to` (required, UTC), `offset`, `limit`.  
  - Max 90-day range, same row contract as unbounded `ledger-entries` listing for that wallet.  
- **Web — finance page**  
  - **سجل العمليات** (full ledger) unchanged.  
  - **تقرير حركات المحفظة (بالفترة)** below it: default last 7 days, local inputs, **تطبيق**, load-more, no-wallet and error handling.  
- **CSV — تنزيل CSV** next to **تطبيق**  
  - Same `walletAccountId` and applied `from`/`to`; paginates the same GET until complete; no partial file on failure; defined columns; UTF-8 with BOM.  

## Intentional exclusions (this checkpoint)

- No new backend **export** route (CSV is browser-only).  
- No PDF, no deploy automation tied to this phase.

## Reference (implementation touchpoints)

- API: `apps/api` — `wallet-read` routes, `listLedgerActivityReport`, `LedgerActivityReportQuerySchema`, verify script `verify:ledger-activity-report` if present.  
- Web: `apps/web` — `ledger-activity-report-section.tsx`, `use-ledger-activity-report.ts`, `ledger-activity-csv-export.ts`, `getLedgerActivityReport` in `lib/api/services/finance.ts`, `paths.finance.ledgerActivity` in `@captain/shared`.  

---

## Reports continuation batch (stable — **reviewed**)

> Recorded **2026-04-24** after manual review of `/reports` **passed**.

### Verification (recorded)

| Item | Result |
|------|--------|
| Reconciliation summary (cards) | PASS |
| Captain prepaid report (table) | PASS |
| Delivered commissions report (table) | PASS |
| Date-range behavior | PASS |
| RBAC / redirect | PASS |
| Deploy | None |

### Scope (this checkpoint)

- **`GET /api/v1/reports/reconciliation-summary`** — deliver vs prepaid mirror + charge/adjust vs ledger (tenant-scoped).  
- **`GET /api/v1/captains/:id/prepaid-transactions`** — optional `from` + `to` (with pagination).  
- **`GET /api/v1/reports/delivered-commissions`** — delivered commission lines from wallet ledger, paginated.  
- **Web** — `GET` route `/reports`, shared single date range strip, sections 1–3.  

### Reference (touchpoints)

- `apps/api` — `reports.service.ts`, `reports.controller.ts`, `reports.routes.ts`, `validators/reports.schemas.ts`, `captain-prepaid-balance.service` list filter.  
- `apps/web` — `features/reports/reports-page-view.tsx`, `pages/reports-page.tsx`, `lib/api/services/reports.ts`, `paths.reports` in `@captain/shared`.  

*Next work: on explicit instruction only.*
