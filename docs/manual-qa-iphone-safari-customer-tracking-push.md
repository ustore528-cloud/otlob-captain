# Manual QA — iPhone Safari — customer tracking & Web Push

**Goal:** Validate public order tracking UX and optional Web Push on iPhone Safari, aligned with Safari’s requirement that Web Push from the customer site typically works only after **Add to Home Screen** and launching the **installed web app** from the Home Screen icon (on supported iOS versions).

---

## Prerequisites

- HTTPS production (or staging) deployment of the **customer-facing** site (`vite preview`/`production`; not plain `vite dev` if SW/push gates disable them).
- API: VAPID keys configured; `CUSTOMER_SITE_ORIGIN` set so notification payloads open the correct tracking URL.
- Known **public tracking link** (`/track/...` or equivalent) with a token that survives the test session.

---

## Result log template (required for each run)

| Field | Value |
| ----- | ----- |
| **Date** | |
| **Device model** | e.g. iPhone 15 |
| **iOS version** | e.g. 17.6.1 |
| **Browser stack** | Safari (in-app) / standalone web app opened from icon |
| **How opened** | **Safari tab** vs **Home Screen icon only** |
| **App / web locale** | ar / en / he |
| **Tester** | |

**Pass rule for outgoing push (cases B §10):** Do **not** mark “iPhone Web Push **PASSED**” unless the subscriber flow and notification receipt were exercised from the **installed** web app opened via the **Home Screen icon** — not only from a regular Safari tab.

Use per-case result: **Pass** / **Fail** / **N/A** (with notes).

---

## Test case A — Before Add to Home Screen (Safari tab)

**Steps**

1. On iPhone, open the **tracking page** in **Safari** (normal tab — not standalone).
2. Observe the notification opt-in region.

**Expected**

1. UI shows the **iPhone guidance card** (Add to Home Screen flow), **not** the primary native “Enable order notifications” subscribe button alone.
2. Guided steps correspond to localization keys (conceptually): **Share** → **Add to Home Screen** → **Open tracking from Home Screen icon** → **Then enable notifications**.
3. The browser **must not** show the notification permission sheet **immediately on page load**; permission is requested only **after an explicit tap** when the standalone subscribe path exists (tracked in UI as `subscribe()` only on button tap; before Home Screen install, Safari tab uses `iosPwaBlocked` guidance without that button).

**Result:** ______ · Notes:

---

## Test case B — After Add to Home Screen (standalone web app)

**Steps**

1. In Safari, tap **Share** → **Add to Home Screen** (confirm naming if prompted).
2. From the Home Screen, open the **new icon** (standalone).
3. Navigate to the **same** tracking URL as in A.
4. Confirm the **Enable order notifications** (or localized equivalent) **button appears** (not blocked by guidance-only UI).
5. Tap the button → approve permission **if** the prompt appears and the OS/browser supports Web Push on that version.
6. Leave the installed web app (home other app / lock screen).
7. From dashboard/API, **change order status**.
8. Observe notification delivery and tap-through.

**Expected**

- Button-only opt-in appears in standalone (`display-mode: standalone` / `navigator.standalone`).
- Tap triggers permission prompt (when supported).
- After subscription: status-driven push yields a notification **outside** Safari when feasible for that OS.
- Tap notification opens **correct tracking page** (`/track/<token>` / absolute URL per payload).

**Result:** ______ · Notes:

---

## Test case C — Unsupported or denied permission

**Steps**

1. Deny notifications, **or** use a combination known not to expose Web Push to web apps.

**Expected**

- **Denied:** Inline fallback copy (localized `customerNotifications.permissionDenied`); **no** success toast spam for denial.

- **Unsupported / APIs missing:** `customerNotifications.unsupported` (or deploy hint if SW/push not available in environment).

- **In-page tracking:** Socket (when connected) and **polling fallback** keep updating status while the page stays **open**, independent of push.

**Result:** ______ · Notes:

---

## Engineering references (verification)

| Behavior | Reference |
| -------- | --------- |
| iOS/iPad detection + standalone | `apps/web/src/features/public-request/customer-order-browser-notifications.tsx` (`detectIosOrIpados`, `detectStandaloneDisplayMode`) |
| Guidance vs subscribe button phases | Same file: `iosPwaBlocked` vs `default`/`subscribed`/etc. |
| Permission only inside `subscribe()` | Same file — no `Notification.requestPermission()` on mount |
| Duplicate subscription persistence | Prisma `@@unique([orderId, endpoint])` on `CustomerPublicPushSubscription`; upsert APIs |
