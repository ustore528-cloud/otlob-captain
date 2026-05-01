import type { OrderStatus } from "@prisma/client";
import { resolveCustomerPushNotificationCopy } from "@captain/shared";
import webpush from "web-push";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/errors.js";
import { CUSTOMER_ORDER_PUBLIC_KEYS } from "../realtime/customer-order-public-tracking.js";

/** Public-site origin for clickable notifications (optional). */
const CUSTOMER_SITE_ORIGIN_RAW = (): string =>
  String(process.env.CUSTOMER_SITE_ORIGIN ?? "").replace(/\/+$/, "").trim();

function vapidPublicRaw(): string | undefined {
  const a = process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
  const b = process.env.PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
  return a || b || undefined;
}

function vapidPrivateRaw(): string | undefined {
  const a = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim();
  const b = process.env.PUBLIC_WEB_PUSH_VAPID_PRIVATE_KEY?.trim();
  return a || b || undefined;
}

function webPushSubject(): string {
  return (
    process.env.WEB_PUSH_SUBJECT?.trim() ||
    process.env.PUBLIC_WEB_PUSH_CONTACT?.trim() ||
    "mailto:support@example.com"
  );
}

export function isPublicCustomerWebPushConfigured(): boolean {
  return Boolean(vapidPublicRaw() && vapidPrivateRaw());
}

export function getPublicCustomerWebPushVapidPublicKey(): string | null {
  return vapidPublicRaw() ?? null;
}

function ensureWebPushVapidConfigured(): void {
  const pub = vapidPublicRaw();
  const priv = vapidPrivateRaw();
  const subject = webPushSubject();
  if (!pub || !priv) {
    throw new Error("WEB_PUSH_NOT_CONFIGURED");
  }
  webpush.setVapidDetails(subject, pub, priv);
}

function buildTrackingUrls(ownerCode: string, orderId: string, token: string): {
  absoluteUrl: string;
  fallbackPath: string;
} {
  const origin = CUSTOMER_SITE_ORIGIN_RAW();
  const trackPath = `/track/${encodeURIComponent(token)}`;
  const fallbackPath =
    `/request/${encodeURIComponent(ownerCode)}` +
    `?track=1&oid=${encodeURIComponent(orderId)}&tok=${encodeURIComponent(token)}`;
  const absoluteUrl = origin ? `${origin}${trackPath}` : fallbackPath;
  return { absoluteUrl, fallbackPath };
}

export async function notifyPublicCustomerOrderTrackingWebPush(
  orderId: string,
  status: OrderStatus,
): Promise<void> {
  if (!isPublicCustomerWebPushConfigured()) return;
  try {
    ensureWebPushVapidConfigured();
  } catch {
    return;
  }

  const subs = await prisma.customerPublicPushSubscription.findMany({
    where: { orderId, isActive: true },
  });
  const subscriptionCount = subs.length;
  if (subscriptionCount === 0) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { orderPublicOwnerCode: true, publicTrackingToken: true },
  });
  const ownerCode = order?.orderPublicOwnerCode ?? null;
  const token = order?.publicTrackingToken ?? null;
  if (!ownerCode || !token) return;

  const { absoluteUrl, fallbackPath } = buildTrackingUrls(ownerCode, orderId, token);
  const keys = CUSTOMER_ORDER_PUBLIC_KEYS[status] ?? CUSTOMER_ORDER_PUBLIC_KEYS.PENDING;
  const origin = CUSTOMER_SITE_ORIGIN_RAW();

  let sent = 0;
  let failed = 0;
  let inactivated = 0;

  for (const s of subs) {
    const { title, body } = resolveCustomerPushNotificationCopy(s.locale, status);
    const updatedAt = new Date().toISOString();
    const subscription = {
      endpoint: s.endpoint,
      keys: { p256dh: s.p256dh, auth: s.auth },
    };

    const payload = JSON.stringify({
      title,
      body,
      titleKey: keys.statusLabelKey,
      bodyKey: keys.messageKey,
      status,
      trackingToken: token,
      updatedAt,
      url: absoluteUrl,
      tag: `public-order:${orderId}`,
      data: {
        url: absoluteUrl,
        trackingToken: token,
        ...(origin ? { fallbackUrl: `${origin}${fallbackPath}` } : {}),
      },
    });

    try {
      await webpush.sendNotification(subscription, payload, {
        TTL: 3600,
        urgency: "normal",
      });
      sent += 1;
      await prisma.customerPublicPushSubscription.update({
        where: { id: s.id },
        data: { lastSuccessAt: new Date(), isActive: true },
      });
    } catch (e: unknown) {
      failed += 1;
      const code =
        typeof e === "object" && e !== null && "statusCode" in e
          ? Number((e as { statusCode: number }).statusCode)
          : NaN;
      const isGone = code === 404 || code === 410;
      await prisma.customerPublicPushSubscription
        .update({
          where: { id: s.id },
          data: {
            lastFailureAt: new Date(),
            ...(isGone ? { isActive: false } : {}),
          },
        })
        .catch(() => {});
      if (isGone) inactivated += 1;
    }
  }

  console.info("[customer-web-push]", {
    orderId,
    trackingToken: token,
    status,
    subscriptionCount,
    sentCount: sent,
    failedCount: failed,
    inactiveCount: inactivated,
  });
}

export async function upsertPublicCustomerOrderPushSubscription(input: {
  ownerCode: string;
  orderId: string;
  trackingToken: string;
  locale?: string | null;
  userAgent?: string | null;
  platform?: string | null;
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
}): Promise<void> {
  const trimmedTok = input.trackingToken.trim();
  if (!trimmedTok) throw new AppError(400, "رمز التتبع مطلوب.", "BAD_REQUEST");
  const order = await prisma.order.findFirst({
    where: {
      id: input.orderId,
      orderPublicOwnerCode: input.ownerCode,
      publicTrackingToken: trimmedTok,
    },
    select: { id: true, publicTrackingToken: true },
  });
  if (!order?.publicTrackingToken) {
    throw new AppError(404, "الطلب غير موجود أو الرمز غير صالح.", "NOT_FOUND");
  }

  await prisma.customerPublicPushSubscription.upsert({
    where: {
      orderId_endpoint: {
        orderId: order.id,
        endpoint: input.subscription.endpoint,
      },
    },
    create: {
      orderId: order.id,
      publicTrackingToken: order.publicTrackingToken,
      endpoint: input.subscription.endpoint,
      p256dh: input.subscription.keys.p256dh,
      auth: input.subscription.keys.auth,
      locale: input.locale ?? null,
      userAgent: input.userAgent ?? null,
      platform: input.platform ?? null,
      isActive: true,
    },
    update: {
      publicTrackingToken: order.publicTrackingToken,
      p256dh: input.subscription.keys.p256dh,
      auth: input.subscription.keys.auth,
      locale: input.locale ?? null,
      userAgent: input.userAgent ?? null,
      platform: input.platform ?? null,
      isActive: true,
    },
  });
}

/** POST `/public/orders/:trackingToken/push-subscription` — resolve order by public tracking token only. */
export async function upsertCustomerWebPushSubscriptionByTrackingToken(input: {
  trackingToken: string;
  locale?: string | null;
  userAgent?: string | null;
  platform?: string | null;
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
}): Promise<void> {
  const trimmedTok = input.trackingToken.trim();
  if (!trimmedTok) throw new AppError(400, "رمز التتبع مطلوب.", "BAD_REQUEST");
  const order = await prisma.order.findUnique({
    where: { publicTrackingToken: trimmedTok },
    select: { id: true, publicTrackingToken: true },
  });
  if (!order?.publicTrackingToken) {
    throw new AppError(404, "الطلب غير موجود أو الرمز غير صالح.", "NOT_FOUND");
  }

  await prisma.customerPublicPushSubscription.upsert({
    where: {
      orderId_endpoint: {
        orderId: order.id,
        endpoint: input.subscription.endpoint,
      },
    },
    create: {
      orderId: order.id,
      publicTrackingToken: order.publicTrackingToken,
      endpoint: input.subscription.endpoint,
      p256dh: input.subscription.keys.p256dh,
      auth: input.subscription.keys.auth,
      locale: input.locale ?? null,
      userAgent: input.userAgent ?? null,
      platform: input.platform ?? null,
      isActive: true,
    },
    update: {
      p256dh: input.subscription.keys.p256dh,
      auth: input.subscription.keys.auth,
      locale: input.locale ?? null,
      userAgent: input.userAgent ?? null,
      platform: input.platform ?? null,
      isActive: true,
    },
  });
}
