/**
 * Customer-facing Web Push + opt-in copy (AR / EN / HE).
 * Keep Prisma `OrderStatus` values in sync with ORDER_STATUS_TO_NOTIFICATION_STATUS_BODY.
 */

export type CustomerNotificationLang = "ar" | "en" | "he";

/** Keys under `customerNotifications.status.*` */
export type CustomerNotificationStatusKey =
  | "ORDER_CREATED"
  | "ACCEPTED"
  | "CAPTAIN_ASSIGNED"
  | "ON_THE_WAY_TO_PICKUP"
  | "PICKED_UP"
  | "ON_THE_WAY_TO_CUSTOMER"
  | "DELIVERED"
  | "CANCELED";

/** Prisma `OrderStatus` string enum — mirror apps/api/prisma/schema.prisma */
export type CustomerPushOrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "ASSIGNED"
  | "ACCEPTED"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "CANCELLED";

export const ORDER_STATUS_TO_NOTIFICATION_STATUS_BODY: Record<
  CustomerPushOrderStatus,
  CustomerNotificationStatusKey
> = {
  PENDING: "ORDER_CREATED",
  CONFIRMED: "ACCEPTED",
  ASSIGNED: "CAPTAIN_ASSIGNED",
  ACCEPTED: "ON_THE_WAY_TO_PICKUP",
  PICKED_UP: "PICKED_UP",
  IN_TRANSIT: "ON_THE_WAY_TO_CUSTOMER",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELED",
};

export type CustomerNotificationsNested = {
  enableTitle: string;
  enableBody: string;
  enableButton: string;
  enableBusy: string;
  grantReady: string;
  enabledSuccess: string;
  enabledSuccessDetail: string;
  retryButton: string;
  setupFailed: string;
  permissionDenied: string;
  unsupported: string;
  iosTitle: string;
  iosBody: string;
  iosStepShare: string;
  iosStepAddHome: string;
  iosStepOpenIcon: string;
  iosStepEnable: string;
  iosDisclaimer: string;
  statusChangedTitle: string;
  status: Record<CustomerNotificationStatusKey, string>;
};

export type CustomerNotificationsResource = {
  customerNotifications: CustomerNotificationsNested;
};

function normalizeCustomerNotificationLang(raw: string | null | undefined): CustomerNotificationLang {
  const k = String(raw ?? "en").split("-")[0]?.toLowerCase();
  if (k === "ar" || k === "he") return k;
  return "en";
}

export function resolveCustomerPushNotificationCopy(
  langRaw: string | null | undefined,
  orderStatus: string,
): { title: string; body: string } {
  const lang = normalizeCustomerNotificationLang(langRaw);
  const b = CUSTOMER_NOTIFICATIONS_BY_LANG[lang].customerNotifications;
  const key = String(orderStatus ?? "").toUpperCase() as CustomerPushOrderStatus;
  const bodyName = ORDER_STATUS_TO_NOTIFICATION_STATUS_BODY[key] ?? "ORDER_CREATED";
  const body =
    b.status[bodyName] ?? CUSTOMER_NOTIFICATIONS_BY_LANG.en.customerNotifications.status[bodyName] ?? "";
  return { title: b.statusChangedTitle, body };
}

export const CUSTOMER_NOTIFICATIONS_BY_LANG: Record<CustomerNotificationLang, CustomerNotificationsResource> = {
  en: {
    customerNotifications: {
      enableTitle: "Enable order notifications",
      enableBody:
        "Get notified when your order status changes, even if you leave the order page, where supported.",
      enableButton: "Enable order notifications",
      enableBusy: "Enabling…",
      grantReady: "Notifications are already allowed — tap once to subscribe on this device.",
      enabledSuccess: "Notifications enabled",
      enabledSuccessDetail:
        "We'll notify you here when your order status changes (where supported). Updates still work live on this page.",
      retryButton: "Try again",
      setupFailed: "We couldn't finish setup. You can try again below.",
      permissionDenied: "Permission was denied. Updates will continue to work inside this order page only.",
      unsupported:
        "Your device or browser doesn't support off-site notifications. Keep the order page open to receive updates.",
      iosTitle: "Enable order notifications on iPhone",
      iosBody:
        "On iPhone, add this website to your Home Screen first, then open it from the new icon to enable notifications.",
      iosStepShare: "Tap the Share button in Safari.",
      iosStepAddHome: 'Choose "Add to Home Screen".',
      iosStepOpenIcon: "Open the order page from the new Home Screen icon.",
      iosStepEnable: 'Tap "Enable order notifications".',
      iosDisclaimer:
        "Web Push availability depends on your iPhone model, iOS version, and Safari — we don't promise it on every combination. This page keeps updating while it's open regardless.",
      statusChangedTitle: "Order update",
      status: {
        ORDER_CREATED: "Your order has been received.",
        ACCEPTED: "Your order has been accepted.",
        CAPTAIN_ASSIGNED: "A captain has been assigned to your order.",
        ON_THE_WAY_TO_PICKUP: "The captain is on the way to pick up your order.",
        PICKED_UP: "Your order was picked up from the store.",
        ON_THE_WAY_TO_CUSTOMER: "The captain is on the way to you.",
        DELIVERED: "Your order was delivered.",
        CANCELED: "Your order was cancelled.",
      },
    },
  },
  ar: {
    customerNotifications: {
      enableTitle: "فعّل إشعارات الطلب",
      enableBody: "وصلك تنبيه عند تغيّر حالة الطلب، حتى لو خرجت من صفحة الطلب، حسب دعم جهازك.",
      enableButton: "تفعيل إشعارات الطلب",
      enableBusy: "جارٍ التفعيل…",
      grantReady: "التنبيهات مسموحة لهذا الموقع مسبقاً — اضغط مرة واحدة للاشتراك.",
      enabledSuccess: "تم تفعيل الإشعارات",
      enabledSuccessDetail:
        "سنوصل لك تنبيهاً هنا عند تغيّر حالة الطلب (إن دعمتها متصفّحك). ستبقى التحديثات تعمل أيضاً داخل هذه الصفحة.",
      retryButton: "حاول مجدداً",
      setupFailed: "لم نكمِّل الإعداد — يمكنك المحاولة مرة أخرى بالأسفل.",
      permissionDenied: "تم رفض الإذن. ستبقى التحديثات تعمل داخل صفحة الطلب فقط.",
      unsupported: "جهازك أو متصفحك لا يدعم إشعارات خارج الموقع. أبقِ صفحة الطلب مفتوحة لتلقي التحديثات.",
      iosTitle: "لتفعيل إشعارات الطلب على iPhone",
      iosBody: "على iPhone، يجب إضافة الموقع إلى الشاشة الرئيسية أولًا حتى تعمل إشعارات الطلب خارج المتصفح.",
      iosStepShare: "اضغط زر المشاركة في Safari.",
      iosStepAddHome: 'اختر "إضافة إلى الشاشة الرئيسية".',
      iosStepOpenIcon: "افتح الطلب من الأيقونة الجديدة على الشاشة الرئيسية.",
      iosStepEnable: 'اضغط "تفعيل إشعارات الطلب".',
      iosDisclaimer:
        "توافر تنبيهات الويب على iPhone يعتمد على طراز الجهاز وإصدار iOS وSafari — لا نضمنها على كل الأجهزة. صفحة الطلب تتابع التحديث طالما هي مفتوحة في كل الأحوال.",
      statusChangedTitle: "تحديث على طلبك",
      status: {
        ORDER_CREATED: "تم استلام طلبك.",
        ACCEPTED: "تم قبول طلبك.",
        CAPTAIN_ASSIGNED: "تم تعيين كابتن لطلبك.",
        ON_THE_WAY_TO_PICKUP: "الكابتن في الطريق لاستلام طلبك.",
        PICKED_UP: "تم استلام الطلب من المتجر.",
        ON_THE_WAY_TO_CUSTOMER: "الكابتن في الطريق إليك.",
        DELIVERED: "تم تسليم الطلب.",
        CANCELED: "تم إلغاء الطلب.",
      },
    },
  },
  he: {
    customerNotifications: {
      enableTitle: "הפעלת התראות הזמנה",
      enableBody:
        "קבלו התראה כשסטטוס ההזמנה משתנה — גם אם תעזבו את עמוד ההזמנה, היכן שהמכשיר והדפדפן תומכים בכך.",
      enableButton: "להפעיל התראות הזמנה",
      enableBusy: "מפעילים…",
      grantReady: "ההתראות כבר מותרות לאתר זה — הקישו פעם אחת להשלמת ההרשמה.",
      enabledSuccess: "ההתראות הופעלו",
      enabledSuccessDetail:
        "נשלח אליכם עדכון כאן כשסטטוס ההזמנה משתנה (כשהדפדפן תומך). העדכונים ממשיכים לפעול גם בעמוד זה.",
      retryButton: "נסו שוב",
      setupFailed: "לא השלמנו את ההגדרה — אפשר לנסות שוב למטה.",
      permissionDenied: "ההרשאה נדחתה. העדכונים ימשיכו לפעול רק בתוך עמוד ההזמנה.",
      unsupported:
        "המכשיר או הדפדפן שלכם לא תומכים בהתראות מחוץ לאתר. השאירו את עמוד ההזמנה פתוח כדי לקבל עדכונים.",
      iosTitle: "הפעלת התראות הזמנה ב‑‍iPhone",
      iosBody:
        "ב‑‍iPhone יש להוסיף תחילה את האתר למסך הבית ואז לפתוח מהאייקון החדש — כדי שאפשר יהיה להפעיל התראות מחוץ לדפדפן בהתאם לתמיכה.",
      iosStepShare: "הקישו על כפתור השיתוף (Share) ב‑‍Safari.",
      iosStepAddHome: `בחרו "הוסף למסך הבית" (‎Add to Home Screen‎).`,
      iosStepOpenIcon: "פתחו את עמוד ההזמנה מהאייקון החדש במסך הבית.",
      iosStepEnable: `הקישו על "להפעיל התראות הזמנה".`,
      iosDisclaimer:
        "התראות Web Push ב‑‍iPhone תלויות במכשיר, בגרסת iOS וב‑‍Safari — אין להבטיח שזה זמין בכל שילוב. עמוד המעקב מתעדכן גם כשהוא פתוח, בלי התראות דחיפה.",
      statusChangedTitle: "עדכון על ההזמנה",
      status: {
        ORDER_CREATED: "ההזמנה התקבלה.",
        ACCEPTED: "ההזמנה שלכם אושרה.",
        CAPTAIN_ASSIGNED: "שויך שליח להזמנה שלכם.",
        ON_THE_WAY_TO_PICKUP: "השליח בדרך לאיסוף ההזמנה.",
        PICKED_UP: "ההזמנה נאספה מהחנות.",
        ON_THE_WAY_TO_CUSTOMER: "השליח בדרך אליכם.",
        DELIVERED: "ההזמנה נמסרה.",
        CANCELED: "ההזמנה בוטלה.",
      },
    },
  },
};
