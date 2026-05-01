# Security verification — public customer tracking, socket & Web Push (Step 10)

This document ties each verification item to behaviour in repository code. Operational checks (captain Expo push, rotating secrets in CI/CD) remain **manual QA** where noted.

| # | Requirement | Repo evidence | Notes / manual confirmation |
|---|-------------|---------------|---------------------------|
| **1** | Subscribe only with a **valid tracking token** | `upsertCustomerWebPushSubscriptionByTrackingToken`: `findUnique({ where: { publicTrackingToken } })`; `404 NOT_FOUND` if missing (`customer-public-order-web-push.service.ts`). Route `POST .../orders/:trackingToken/push-subscription` validated via `PublicWebPushSubscribeByTokenParamsSchema`. | Prefer **204** success only after DB match. |
| **2** | Customer **A ≠ B** event isolation | Socket: `customerSocketRoomForTrackingToken(token)` (`customer-order-public-tracking.ts`); emits `io?.to(room).emit(...)` with token taken from DB for that `orderId` (`hub.ts`). Push: `findMany({ where: { orderId, isActive: true }})` tied to subscriptions created for resolved order (`notifyPublicCustomerOrderTrackingWebPush`). | Attacker joining B’s channel needs B’s token (same secrecy as tracking link). |
| **3** | Invalid token **cannot join** socket room | `socket-server.ts` `customer:join_order`: DB `findUnique` on `publicTrackingToken`; mismatch → `customer:join_order:error` `{ code: "INVALID_TOKEN" }`; no `join` without success. Empty/oversized (`> maxLen`) also rejected client-side limits. | `public_order_page` namespace has **no JWT**; server still gates room join by DB-backed token only. |
| **4** | Invalid token **cannot save** push subscription | Same resolver as row 1: no order → upsert never runs (`NOT_FOUND`). | — |
| **5** | Push payload contains **no PII**/private order fields | Payload JSON (`customer-public-order-web-push.service.ts`): `title`, `body`, Socket-style `titleKey`/`bodyKey`, `status`, `trackingToken`, `updatedAt`, `url`, `tag`, structured `data` for navigation. No phone, addresses, names, captain identity, amounts. | Payload is inherently visible to Push endpoint + device; minimise fields (current set is intentional). |
| **6** | Socket payload contains **no PII**/private fields | Emit body (`hub.ts`): `trackingToken`, `status`, `statusLabelKey`, `messageKey`, `updatedAt`. No internal `orderId` in emitted client body. *(Server **logs** `orderId` in `console.info` for ops — restrict log sinks in prod.)* | Labels are translation keys only. |
| **7** | **No VAPID private key** in frontend bundle | Frontend only declares `VITE_WEB_PUSH_VAPID_PUBLIC_KEY` (`vite-env.d.ts`, `.env.example`); subscribe uses **`process.env`/API** private keys only on server (`customer-public-order-web-push.service.ts`). Run `pnpm build`/inspect `dist/` for accidental `PRIVATE` literals. | — |
| **8** | **No secrets committed** | `.gitignore` includes `.env`, `.env.*` with exceptions for `.env.example` only; no tracked `.env` in git (verify with `git ls-files '*.env'`). Sample keys only in commented `.env.example` lines. Repo scan: avoid committing PEM blocks / live tokens. | Run secret scanners in CI; rotate if leaked historically. |
| **9** | **Expired/unusable** subscriptions disabled | Web Push errors with HTTP **404**/**410** deactivate row (`isActive: false`) in catch path (`notifyPublicCustomerOrderTrackingWebPush`). | Other failures keep row active — monitor send metrics. |
| **10** | **Captain mobile** push unaffected | Separate service `push-notification.service.ts` (Expo) used from `orders.service`, distribution, captain mobile controllers. Customer path uses **`web-push`** + `customerPublicPushSubscription` only. | Smoke test captain device after deploy (new order alert / acceptance). |

## Validator alignment (DB)

Public tracking tokens are stored as **`@db.VarChar(64)`**. API Zod validators use **`publicTrackingTokenValue`** capped at **64** characters (`public-request.schemas.ts`), consistent with Socket length checks.

## Operational checklist before “PASS”

- [ ] `WEB_PUSH_*` keys set only on server / secret manager; never in `apps/web/.env.local` checked into Git.
- [ ] `CUSTOMER_SITE_ORIGIN` correct for clickable notification URLs.
- [ ] Captain app receives at least one test push on staging after customer-push changes merged.
