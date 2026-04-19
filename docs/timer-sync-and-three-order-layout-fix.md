# Timer sync & multi-order layout (captain mobile)

Focused verification and fixes for: (A) 30-second offer countdown alignment with the dispatcher panel, and (B) showing multiple orders for one captain without hiding list items behind the primary card.

---

## A. Timer Source of Truth

### Authoritative timestamp

- **`OrderAssignmentLog.expiredAt`** (UTC in DB), returned to mobile as `log.expiresAt` on `GET /mobile/captain/me/assignment`.

### Where mismatch existed

| Layer | Before | After |
|--------|--------|--------|
| **Dispatcher panel** | `assignmentOfferSecondsLeft(iso)` = `Math.max(0, Math.ceil((iso - Date.now()) / 1000))`, map ticks every 1s | Unchanged |
| **Captain app (offer hint)** | Static text **`timeoutSeconds` (30)** from API + wall-clock `formatLastSeenAr(expiresAt)` — **no per-second countdown** | Same **ceil** formula as web in `lib/assignment-offer-seconds-left.ts`, recomputed **every second** via `useAssignmentOfferSecondsTick`, shown as **`المتبقي: N ث`** |

### Why the app looked “stuck at 30”

- The UI literally displayed the configured **`timeoutSeconds`** (always 30) as “زمن تقريبي… 30 ثانية” and did not derive **remaining** seconds from `expiresAt` each second, so the number never counted down in sync with the panel.

---

## B. Real 30-Second Behavior

- **User-visible countdown** on mobile now tracks **`expiresAt` vs `Date.now()`** with the **same ceil** rule as the panel, updating every **1s**.
- **API enforcement** of accept/reject is still at **`expiredAt`** (immediate).
- **Background expiry / worker** can still lag by up to **`DISTRIBUTION_POLL_MS`** (documented on API) — not changed here.
- **Stale `expiresAt` on the device** can lag the server by up to assignment query **stale/refetch** intervals; countdown uses the last fetched ISO. Minor second-level drift vs panel is possible until the next refetch.

---

## C. Multiple-Order UI Analysis

### Why multiple orders were not clear

1. **Duplicate row**: The **same** order could appear in the **header workbench card** and again in the **infinite list** (same `orderId`), so the “second” order looked like a duplicate or was confusing.
2. **Tall cards**: `OrderRouteTapRows` (two large tap rows) + full payment block + footer made each card **very tall**, so **~1** card filled the viewport above filters.
3. **Dock**: The assignment **footer** sits below the `FlatList`; extra **bottom padding** was needed so the last visible list row is not tight against the dock.

### What we changed

- **`excludeOrderIds`**: While the current assignment (`OFFER` / `ACTIVE`) is shown in the header, that **`order.id` is filtered out** of the list data.
- **Compact density**: `OrderRouteTapRows` **`compact`** mode (tighter rows, single-line addresses), smaller **workbench** and **list** cards on the orders tab (`flatVisual`).
- **Hint line**: Short Arabic line **“طلبات أخرى وسجلك أدناه — مرّر للعرض”** between the primary block and filters.
- **`listContentWithDock`**: Extra **`paddingBottom: 100`** when `minimalChrome` + `fixedFooter` so scrolling clears the action dock.

---

## D. Fixes Applied

| File | What |
|------|------|
| `apps/captain-mobile/src/lib/assignment-offer-seconds-left.ts` | Same `ceil` seconds-left formula as `captain-map-visual.ts` |
| `apps/captain-mobile/src/hooks/use-assignment-offer-seconds-tick.ts` | 1s tick → recomputed seconds |
| `apps/captain-mobile/src/features/assignment/hooks/use-captain-assignment-workbench.tsx` | Offer hint uses **live** `المتبقي: N ث`; workbench cards use **`compact`** |
| `apps/captain-mobile/src/features/orders/components/captain-workbench-order-card.tsx` | **`compact`** layout: less padding, compact routes, shorter money/footer |
| `apps/captain-mobile/src/features/orders/components/order-route-tap-rows.tsx` | **`compact`** variant for shorter rows |
| `apps/captain-mobile/src/features/orders/components/captain-order-list-card.tsx` | **`compact` routes** when `flatVisual`; denser `cardFlat` |
| `apps/captain-mobile/src/features/orders/screens/order-history-screen.tsx` | **`excludeOrderIds`**, **`filteredItems`**, hint strip, dock **paddingBottom** |
| `apps/captain-mobile/src/features/orders/screens/orders-work-screen.tsx` | **`useCaptainAssignment`** → **`excludeOrderIds`**, tighter **`currentSlot`** |

**Why safe:** No API or distribution business rules changed; UI-only countdown math aligned with web; list filtering only removes a duplicate id already shown above.

---

## E. Remaining Risks

- **Clock skew** between device and server could shift displayed seconds vs panel (rare).
- **`expiresAt` cache**: Until assignment refetches, mobile uses the last ISO; panel map may refetch on a different cadence (~4s on distribution page) — possible **1–2s** mismatch at worst.
- **Worker delay** after 00:00 on countdown is still possible for **state** transitions; accept/reject at HTTP layer remains strict.
- **~3 cards on screen** is **device-dependent**; we reduced height but did not fix a pixel-perfect count.

---

## F. Final Answers

1. **Does the panel timer now match the app timer?**  
   **For the displayed second value:** yes — same **`ceil((expiresAt − now) / 1000)`** and **1s** updates on the offer hint, aligned with the dispatcher map logic.

2. **Is the visible confirmation cycle really 30 seconds?**  
   **Countdown display:** tracks **server `expiresAt`** until 0. **Enforcement:** still exactly at **`expiredAt`** for accept/reject. **Background expiry** may still lag by **poll interval** (documented server behavior).

3. **Are multiple orders for the same captain now shown clearly below the first?**  
   **Yes** — primary stays in the header; the same order is **not** duplicated in the list; additional orders appear in the **scrollable list** below with a short hint.

4. **Does the screen now fit ~3 orders comfortably?**  
   **Improved** via **compact** cards and **deduped** list; exact count varies by **device height** and **filter chips**; not guaranteed for all phones.

---

*Report generated as part of focused timer + layout work.*
