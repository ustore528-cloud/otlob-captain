# Order / store `branch_id` mismatch (read-only note)

## Rows

Four non-archived orders share store `cmob0w2ck000gumiw9fvx4mvb` (company `cd8xptlzhophhzlxl036ehf6g`) where `orders.branch_id` (`cpkeiii7o4nfcxx7d0ymncwcs`) ≠ `stores.branch_id` (`cmob0vznz0001umiwd5v1bpx0`).

| order id | status | created_at (UTC) |
|----------|--------|------------------|
| `cmocbh7tr0001um7whnyvpuh9` | PENDING | 2026-04-24T02:54:19.360Z |
| `cmocbided0001umq8jqn51amv` | PENDING | 2026-04-24T02:55:13.237Z |
| `cmocbj5a00001umrkfw5fu3wc` | DELIVERED | 2026-04-24T02:55:49.369Z |
| `cmocdztfb0001um6s9tn5p01r` | DELIVERED | 2026-04-24T04:04:46.391Z |

`created_by_user_id` and `order_owner_user_id` are null on these rows.

## Evidence

- The store’s `updated_at` equals `created_at` (no in-app store branch change after creation).
- Older orders on the same store (2026-04-23) have `order.branch_id` aligned with `store.branch_id`.
- Current `ordersService.create` always connects `order.branch` to the loaded store’s `branch_id`.

## Conclusion

These rows are **not** explained by intentional denormalization or by the current store-update API path. They are **local data drift** inside one company (likely manual SQL, a one-off script, or a non-repo writer). **No automatic correction** has been applied; fix only after explicit approval.
