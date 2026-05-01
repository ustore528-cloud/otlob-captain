import type { TFunction } from "i18next";
import type { NotificationItemDto, NotificationLocaleTriplet } from "@/services/api/dto";

function lngBase(resolvedLng: string): "ar" | "en" | "he" {
  const b = (resolvedLng ?? "en").split("-")[0];
  if (b === "ar" || b === "he") return b;
  return "en";
}

/**
 * Picks localized string for the active UI language.
 * Does not fall back to Arabic when the UI is English or Hebrew (avoids mixed-language cards).
 */
function pickTriplet(tri: NotificationLocaleTriplet | undefined, resolvedLng: string): string | null {
  if (!tri) return null;
  const b = lngBase(resolvedLng);
  if (b === "ar") return tri.ar ?? tri.en ?? tri.he ?? null;
  if (b === "he") return tri.he ?? tri.en ?? null;
  return tri.en ?? tri.he ?? null;
}

function hasArabicScript(s: string): boolean {
  return /[\u0600-\u06FF]/.test(s);
}

const PUSH_NEW_ORDER_TITLES = new Set([
  "طلب توصيل جديد",
  "New delivery request",
  "בקשת משלוח חדשה",
]);
const PUSH_NEW_ORDER_BODIES = new Set([
  "لديك طلب جديد بانتظار القبول خلال 30 ثانية",
  "You have a new order waiting for acceptance for 30 seconds",
  "יש לך הזמנה חדשה שממתינה לאישור למשך 30 שניות",
]);

const PUSH_STATUS_TITLES = new Set(["تم تحديث حالة الطلب", "Order status updated", "סטטוס ההזמנה עודכן"]);
const PUSH_STATUS_BODIES = new Set([
  "تم تحديث حالة الطلب الخاص بك",
  "Your order status has been updated",
  "סטטוס ההזמנה שלך עודכן",
]);

const RE_OFFER_AUTO_AR =
  /^طلب (.+): لديك (\d+) ثانية للقبول أو الانتقال للكابتن التالي\.$/;
const RE_MANUAL_BODY_AR = /^تم تعيينك للطلب (.+)\. يرجى الرد خلال (\d+) ثانية\.$/;
const RE_CANCEL_BODY_AR = /^تم إلغاء تعيينك من الطلب (.+)\.$/;
const RE_REASSIGN_BODY_AR = /^تم إعادة تعيينك للطلب (.+)\.$/;
const RE_ADMIN_BODY_AR = /^تم تعديل حالة الطلب (.+) من لوحة الإشراف — قد لا يعود مُسنداً إليك\.$/;

/**
 * Resolves notification title/body for the active UI language.
 * Prefers `displayI18n` when it yields text for the current locale (without Arabic leakage for EN/HE).
 * Recognizes legacy rows and push-aligned payloads, then maps by `type` where possible.
 */
export function resolveNotificationDisplay(
  item: NotificationItemDto,
  t: TFunction,
  resolvedLng: string,
): { title: string; body: string } {
  const title = item.title ?? "";
  const body = item.body ?? "";
  const b = lngBase(resolvedLng);

  const dt = item.displayI18n?.title;
  const db = item.displayI18n?.body;
  if (dt && db) {
    const pt = pickTriplet(dt, resolvedLng);
    const pb = pickTriplet(db, resolvedLng);
    if (pt && pb) {
      const rejectArabicWhenNotAr = b !== "ar" && (hasArabicScript(pt) || hasArabicScript(pb));
      if (!rejectArabicWhenNotAr) {
        return { title: pt, body: pb };
      }
    }
  }

  const ty = item.type ?? "";

  if (PUSH_NEW_ORDER_TITLES.has(title) && PUSH_NEW_ORDER_BODIES.has(body)) {
    return {
      title: t("captain.notifications.pushNewOrderTitle"),
      body: t("captain.notifications.pushNewOrderBody"),
    };
  }
  if (PUSH_STATUS_TITLES.has(title) && PUSH_STATUS_BODIES.has(body)) {
    return {
      title: t("captain.notifications.pushOrderStatusTitle"),
      body: t("captain.notifications.pushOrderStatusBody"),
    };
  }

  const isOfferType = ty === "ORDER_ASSIGNMENT_OFFER" || ty === "ORDER_OFFER";

  if (isOfferType || title === "طلب — بانتظار قبولك") {
    const auto = body.match(RE_OFFER_AUTO_AR);
    if (auto) {
      return {
        title: t("captain.notifications.orderOfferTitle"),
        body: t("captain.notifications.orderOfferBody", { orderRef: auto[1], seconds: auto[2] }),
      };
    }
  }

  if (isOfferType && (title === "تعيين يدوي" || title === "تعيين (سحب وإفلات)")) {
    const m = body.match(RE_MANUAL_BODY_AR);
    if (m) {
      const titleKey =
        title === "تعيين (سحب وإفلات)"
          ? "captain.notifications.orderOfferDragDropTitle"
          : "captain.notifications.orderOfferManualTitle";
      return {
        title: t(titleKey),
        body: t("captain.notifications.orderOfferManualBody", { orderRef: m[1], seconds: m[2] }),
      };
    }
  }

  if (isOfferType && b !== "ar" && (hasArabicScript(title) || hasArabicScript(body))) {
    return {
      title: t("captain.notifications.orderOfferTitle"),
      body: t("captain.notifications.orderOfferBodyGeneric"),
    };
  }

  if (ty === "ORDER_ASSIGNMENT_CANCELLED" || title === "تم إلغاء التعيين") {
    const m = body.match(RE_CANCEL_BODY_AR);
    if (m) {
      return {
        title: t("captain.notifications.assignmentCancelledTitle"),
        body: t("captain.notifications.assignmentCancelledBody", { orderRef: m[1] }),
      };
    }
  }

  if (ty === "ORDER_REASSIGNED" || title === "إعادة تعيين") {
    const m = body.match(RE_REASSIGN_BODY_AR);
    if (m) {
      return {
        title: t("captain.notifications.reassignedTitle"),
        body: t("captain.notifications.reassignedBody", { orderRef: m[1] }),
      };
    }
  }

  if (ty === "ORDER_ADMIN_RESET" || title === "تحديث الطلب من التوزيع") {
    const m = body.match(RE_ADMIN_BODY_AR);
    if (m) {
      return {
        title: t("captain.notifications.adminResetTitle"),
        body: t("captain.notifications.adminResetBody", { orderRef: m[1] }),
      };
    }
  }

  if (b !== "ar" && (hasArabicScript(title) || hasArabicScript(body))) {
    return {
      title: t("captain.notifications.generalTitle"),
      body: t("captain.notifications.generalBody"),
    };
  }

  return {
    title: title || t("captain.notifications.generalTitle"),
    body: body || t("captain.notifications.generalBody"),
  };
}
