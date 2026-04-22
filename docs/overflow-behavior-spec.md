# Overflow Behavior Spec

**Scope:** `GET /api/v1/mobile/captain/me/assignment/overflow`  
**Primary contract unchanged:** `GET /api/v1/mobile/captain/me/assignment` remains singular (`NONE | OFFER | ACTIVE`).

## 1) What counts as overflow

Overflow is any order for the same captain that is currently **assignable or in-flight** but is **not** the primary order selected by the singular `/me/assignment` logic.

Formally:
- Compute `primaryOrderId` with the same selection rules as `/me/assignment`.
- Return other qualifying rows in `items` (excluding `primaryOrderId`).

## 2) Allowed statuses in overflow

Overflow `items` are built from two sources:

1. **Pending offers (`kind = "OFFER"`)**
   - source: `orderAssignmentLog`
   - filters:
     - `responseStatus = PENDING`
     - `expiredAt IS NULL OR expiredAt > now`
     - order is assigned to this captain
     - order status is `ASSIGNED`

2. **Active deliveries (`kind = "ACTIVE"`)**
   - source: `order`
   - filters:
     - assigned to this captain
     - order status in `ACCEPTED | PICKED_UP | IN_TRANSIT`

## 3) Excluded statuses / rows

Excluded from overflow:
- Pending logs with `responseStatus != PENDING`.
- Expired offers (`expiredAt <= now`), except normal null-expiry allowance.
- Orders not assigned to this captain.
- Orders with statuses outside:
  - `ASSIGNED` for offer branch
  - `ACCEPTED | PICKED_UP | IN_TRANSIT` for active branch
- The `primaryOrderId` itself.
- Duplicate order IDs (deduped by `Set`).

## 4) Can pending offers and active orders both appear?

Yes. `items` may contain a mix of:
- secondary pending offers (`kind = "OFFER"`), and
- secondary active orders (`kind = "ACTIVE"`).

This is valid whenever both sets qualify after removing the primary order.

## 5) Ordering rules

`items` ordering is deterministic by source append order:
1. All qualifying pending offers first, ordered by:
   - `expiredAt ASC`, then
   - `assignedAt DESC`
2. Then qualifying active orders, ordered by:
   - `updatedAt DESC`

No cross-source global sort is applied.

## 6) Why `primaryOrderId` must be excluded from `items`

`primaryOrderId` is excluded to keep a strict split between:
- **primary surfaced snapshot** (`/me/assignment`), and
- **secondary overflow set** (`/me/assignment/overflow`).

This prevents duplicate rendering/actions for the same order and ensures overflow means “additional beyond the primary card,” not “all including primary.”

## 7) Captain-facing meaning of overflow presence

If `items.length > 0`, the captain should understand:
- there are additional relevant orders not shown on the primary live card,
- primary card behavior is unchanged,
- overflow provides awareness/navigation for secondary workload.

If `items.length === 0`, there is no secondary assignable/in-flight order beyond the primary snapshot at read time.
