# Captain Mobile — Android / APK / Expo Real-Device Validation

**Scope:** Build/install paths, networking, session, foreground/background, Socket.IO + polling on **real Android** and emulator.  
**Out of scope:** Distribution engine design (see other docs).

---

## 1. Build and Install Paths

| Mode | How | What to test | Limitations |
|------|-----|--------------|-------------|
| **Expo Go** | `npx expo start` → scan QR with Expo Go app | Fast iteration, login, API on LAN, basic Socket | **Custom native modules** limited to Expo SDK; may differ from production APK. Not a substitute for final APK sign-off. |
| **Development build** | `expo run:android` or dev client (if configured) | Closer to native; debugging, same JS bundle shape as dev | Requires Android SDK; install via USB/emulator. |
| **EAS Preview APK** | `eas build --profile preview` (see `apps/captain-mobile/eas.json`: `preview` → `buildType: apk`, internal distribution) | **Primary path for “real APK” QA** — install `.apk` on device | Each build bakes `EXPO_PUBLIC_*` at build time — wrong env = wrong API until rebuild. |
| **EAS Production AAB** | `production` profile → **app-bundle** (Play Store style) | Store pipeline / final QA | Not an APK; different install flow than sideload APK. |

**What should be tested in each mode**

- **Expo Go:** connectivity, login, session, assignment visibility, accept/reject happy path, background/foreground smoke.
- **Dev build:** Same + native permissions (location), USB debugging logs.
- **Preview APK:** Full checklist below — **this is the gate for “APK-ready”** internal distribution.

---

## 2. Environment Checklist

### 2.1 `EXPO_PUBLIC_API_URL`

- **Required:** Same origin for **REST + Socket.IO** (see `src/services/socket/socket-client.ts` — uses `env.apiUrl`).
- **No trailing slash** (stripped in `src/utils/env.ts`).
- **Real device on Wi‑Fi:** use `http://<PC-LAN-IP>:4000` — **not** `localhost` / `127.0.0.1` (warning in dev if loopback on device).
- **`.env.example`** may list `EXPO_PUBLIC_SOCKET_URL` — the app’s `env.ts` currently exposes **`apiUrl` only**; ensure the URL you need is in **`EXPO_PUBLIC_API_URL`** for both HTTP and socket.

### 2.2 Emulator vs real device

| Topic | Emulator | Real device |
|-------|----------|-------------|
| Host machine API | Often `http://10.0.2.2:<port>` (Android) | LAN IP of dev machine |
| localhost | Points to **emulator**, not your PC | N/A unless USB port forward |

### 2.3 HTTPS (later release)

- Staging/production should use **HTTPS** with valid certs; Socket.IO must work over **wss** with same host/cookie expectations as your API.
- **HTTP cleartext** on LAN is typical for dev; **release APK** targeting Play may need **network security config** / HTTPS only — verify before store submission (project-specific).

### 2.4 Android permissions / settings

- **Location** — requested via `expo-location` plugin (`app.json`); grant/deny paths should not crash.
- **Data saver / battery optimization** — can delay background work; note if assignment refresh is slower.
- **Private DNS / VPN** — can block LAN IP; test with them off first.

---

## 3. Real Device Test Scenarios

Record: build mode, API URL, time, device model, OS version (use `docs/manual-qa-execution-results.md` style evidence).

| # | Scenario | Steps | Pass criteria |
|---|----------|-------|----------------|
| R1 | **Install / open** | Install APK or open Expo; cold start | App reaches login or main UI without permanent white screen |
| R2 | **Login** | Valid captain credentials | Enters app; `me` loads |
| R3 | **Session after kill** | Force-stop app → reopen | Still logged in (tokens in secure store) unless refresh invalid |
| R4 | **Order assigned (foreground)** | Dispatcher assigns; app open on Orders/home | Offer or assignment appears within socket + poll window |
| R5 | **Order assigned (background)** | Send app to background; trigger assignment | Notification list / assignment updates on return OR within polling |
| R6 | **Reopen after assignment** | Kill app after assignment created; reopen | Correct state after refetch (not stale forever) |
| R7 | **Accept / reject** | Tap accept or reject on device | Success or clear error; matches API |
| R8 | **Slow network** | Throttle (Android dev options / network link conditioner if available) | Loading states; no duplicate success |
| R9 | **Disconnect / reconnect** | Airplane mode 15–30s → off | Socket reconnects; `invalidateQueries` path updates UI |
| R10 | **Socket vs polling** | Compare behavior with Wi‑Fi off briefly | Fallback polling eventually refreshes assignment |
| R11 | **Timeout / reassignment** | Wait full timeout on unanswered offer | UI clears offer for first captain; aligns with distribution QA doc |

---

## 4. Emulator-Specific Checks

| Topic | Guidance |
|-------|----------|
| **Networking** | API must listen on `0.0.0.0` and firewall allow port; emulator uses **10.0.2.2** to reach host loopback. |
| **10.0.2.2 vs localhost** | **10.0.2.2** = host machine from Android emulator; **localhost** inside emulator ≠ your PC. |
| **`adb reverse`** | Optional: `adb reverse tcp:4000 tcp:4000` so device/emulator can use `localhost:4000` mapped to host — alternative to 10.0.2.2. |
| **Trust level** | Emulator passes **logic** tests; **real phone** still required for: real Wi‑Fi stack, battery, OEM background limits, actual gesture performance. |

---

## 5. APK-Specific Risks

| Risk | Detail |
|------|--------|
| **API URL baked at build** | `EXPO_PUBLIC_API_URL` wrong in EAS secrets/env → all calls go to wrong host until rebuild. |
| **Cleartext HTTP** | LAN HTTP may fail on some **release** builds if network security disallows cleartext — test APK on target channel. |
| **Stale env** | Changing `.env` locally does not change already-built APK — **rebuild** after env change. |
| **Profile mismatch** | `preview` (APK) vs `production` (AAB) — different artifacts; QA both if both ship. |
| **Device-specific networking** | Corporate Wi‑Fi, captive portals, IPv6-only — can break `http://192.168.x.x`. |
| **Socket in release** | Minification / Proguard rarely affects Socket.IO JS; **wrong URL** or **TLS** issues are the usual failures. |

---

## 6. Evidence Checklist (per run)

- [ ] **Screenshots** — login, assignment offer, error state (if any)
- [ ] **Build mode** — Expo Go / dev / EAS preview APK (+ build ID or git SHA)
- [ ] **Exact `EXPO_PUBLIC_API_URL`** used in that build (redact secrets)
- [ ] **API logs** — auth, assignment endpoints if issues
- [ ] **Metro logs** — only if **Expo Go / dev** with Metro attached
- [ ] **`adb logcat`** snippet — for release APK crashes (filter by package `com.captain.mobile`)
- [ ] **Timestamps** — login, assignment event, tap accept/reject
- [ ] **Network condition** — Wi‑Fi / throttled / airplane toggled

---

## 7. Pass / Fail Criteria

| Gate | Pass means |
|------|------------|
| **Expo Go on real device** | Stable login, assignment visible, accept/reject works, reconnect recovers within ~1–2 minutes |
| **Preview APK on real device** | Same + no install/crash regressions + Socket works after cold start |
| **Blocker for release** | Crash on launch; cannot reach API with correct URL; auth broken; accept succeeds with wrong assignee (server bug — still block) |
| **Safe to continue broader Android QA** | Preview APK passes R1–R7 and R9; remaining items are polish |

---

## 8. Final Recommendation (pre-test)

Fill after testing:

| Outcome | When |
|---------|------|
| **Ready for Expo real-device testing only** | Team only validated Metro + Expo Go; no APK yet |
| **Ready for APK internal testing** | Preview APK installs and R1–R7 pass on **physical** device |
| **Block APK testing** | Wrong baked URL, TLS/cleartext failure, crash loop |
| **Safe for staging APK distribution** | Preview APK + full section 3 pass + no blockers in section 7 |

**Default before any run:** *Ready for Expo real-device testing*; promote to *APK internal* only after EAS preview artifact passes on hardware.

---

*Package: `com.captain.mobile` (`app.json`). EAS project id under `expo.extra.eas.projectId`.*
