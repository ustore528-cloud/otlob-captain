import { OrderStatus } from "@prisma/client";

export type ChatbotLocale = "ar" | "en" | "he";

export type ChatbotIntent =
  | "TRACK_ORDER"
  | "HOW_PUBLIC_ORDER"
  | "ORDER_ISSUE"
  | "CAPTAIN_NOT_VISIBLE"
  | "COMPANY_PROFIT_GENERAL"
  | "DISPATCH_HELP"
  | "LOGIN_OR_ACCESS_HELP"
  | "CUSTOMER_CONTACT"
  | "SMALLTALK_FALLBACK";

type OrderFacts = {
  status: OrderStatus;
  hasAssignedCaptain: boolean;
};

const norm = (s: string) =>
  s
    .normalize("NFKC")
    .replace(/[\u0640\u0610-\u061A]/g, "")
    .trim()
    .toLowerCase();

/** مطابقة بسيطة عربية/إنجليزية/عِبْرِيَّة لمَعْرِفة النية الأساسية. */
export function detectChatIntent(message: string, localeHint: ChatbotLocale | undefined): ChatbotIntent {
  const lc = norm(message).replace(/\s+/g, " ");
  const l = lc;

  /**
   * تتبع / أين الطلب — كلا السطحين عموم ومتابعة ضمن المحادثة
   */
  if (
    /\b(track|tracking|delivery status|status of my order)\b/i.test(lc) ||
    /وين|فين|وين الطلب|وين طلبي|مكان الطلب|وصل ولا|طلع الطلب/.test(lc) ||
    /^איפה\s+?(המשלוח|שלי)/.test(message.trim())
  )
    return "TRACK_ORDER";

  if (/كيف .*طلب|كيفية الطلب|كيف اعمل طلب|طريقة الطلب|\bhow (do )?i (make |place )?an order\b/i.test(lc)) {
    return "HOW_PUBLIC_ORDER";
  }

  if (
    /\b(delay|delayed|problem|wrong|mistake)\b/i.test(lc) ||
    /مشكلة|خطأ|تأخر|تأخير|ما وصلني|لم يصل|خلل|خطأ بالطلب|شكاوى/.test(lc) ||
    /בעי(ה|יות)|מה קורה|לא הגיע/i.test(lc)
  ) {
    return "ORDER_ISSUE";
  }

  if (/كابتن|captain|\bcourier\b|\bdelivery\b/i.test(lc) && /ليش|ليش .*ظهر|مش ظهر|ما ظهر|לא מופיע|מחכים|not showing|appear/i.test(lc)) {
    return "CAPTAIN_NOT_VISIBLE";
  }

  if (/تربح|ربح الشركة|\b(monetize|pricing|business model)\b|\bearn money\b|\bשכבת עמלות|איך.*מרוויחים/.test(lc)) {
    return "COMPANY_PROFIT_GENERAL";
  }

  if (/توزيع|خريطة|dispatch|dispatcher|distribution|משלוחים בהפצה|\bheatmap\b|\bמה נקודת ההצבה\b/.test(lc)) {
    return "DISPATCH_HELP";
  }

  if (/login|logged in|jwt|رمز الدخול|كلمة المرور|\bמתחבר\b|\blog in\b|\bנסה להתחבר\b/.test(lc)) {
    return "LOGIN_OR_ACCESS_HELP";
  }

  if (/contact|phone|speak with|خدمة|عملاء|דרך הקשר|\bמתקשר\b|\bמה הטלפון\b|\bדרך ההתראות\b/.test(lc))
    return "CUSTOMER_CONTACT";

  if (/\bthanks?\b|^شكر|תודה|السلام|^سلام|^היי/.test(lc) || l.length <= 14) return "SMALLTALK_FALLBACK";

  return "SMALLTALK_FALLBACK";
}

function pick(locale: ChatbotLocale, trio: Record<ChatbotLocale, string>): string {
  const v = trio[locale];
  return v.trim() !== "" ? v : trio.ar;
}

function bullets(locale: ChatbotLocale, lines: Record<ChatbotLocale, string[]>): string {
  const arr = lines[locale].length ? lines[locale] : lines.ar;
  return arr.map((x) => `• ${x}`).join("\n");
}

/** رد أساسي + اقتراحات سريعة (UI). */
export function buildAssistantReply(payload: {
  intent: ChatbotIntent;
  locale: ChatbotLocale;
  surface: "dashboard" | "customer_public_order" | "customer_public_only";
  orderFacts?: OrderFacts | null;
}): { assistantText: string; quickReplies: string[] } {
  const { intent, locale, surface, orderFacts } = payload;

  /** رد مختصر لمعلومات حالة الطلب دون أسعار حساسة وبلا أفعال آلية */
  let orderSentence = "";
  if (surface === "customer_public_order" && orderFacts) {
    switch (orderFacts.status) {
      case OrderStatus.DELIVERED:
        orderSentence = pick(locale, {
          ar: "\nآخر تحديث: الطلب بحالة «تم التسليم» وفقًا لمسار الشركة الحالي.",
          en: "\nLatest: this order appears as delivered.",
          he: "\nסטטוס אחרון: המשלוח מסומן כנמסר.",
        });
        break;
      case OrderStatus.CANCELLED:
        orderSentence = pick(locale, {
          ar: "\nآخر تحديث: الطلب مُلغى في النظام. إذا اعتقدت أن هذا خطأ، تواصل مع الشركة عبر وسيلتهم المعتادة (الهاتف/الشكوى في صفحة الطلب العام إن وفّرت الشركة ذلك).",
          en: "\nLatest: this order is marked cancelled.",
          he: "\nסטטוס אחרון: ההזמנה בוטלה.",
        });
        break;
      case OrderStatus.PENDING:
      case OrderStatus.CONFIRMED:
        orderSentence = pick(locale, {
          ar: "\nآخر تحديث: لم يتم إسناد كابتن بعد؛ يعتمد ذلك على الزحام، مناطق الخدمة، وإعداد التوزيع لدى الشركة.",
          en: "\nLatest: no courier is assigned yet; assignment depends on operations and routing rules.",
          he: "\nסטטוס נוכחי: עדיין לא שובץ קוריאַר;",
        });
        break;
      case OrderStatus.ASSIGNED:
        if (orderFacts.hasAssignedCaptain)
          orderSentence = pick(locale, {
            ar: "\nتم إرسال الطلب إلى كابتن وهو بحالة انتظار القبول؛ قد لا تظهر بياناته الكاملة في التتبع حتى يقبل أو يتلقاك التطبيق بحالة أحدث.",
            en: "\nAssigned to a captain pending acceptance—you may see limited info until acceptance.",
            he: "\nמשובץ לשליח שממתין לאישור; ייתכן שמוצג רק מה שמתאושר.",
          });
        break;
      case OrderStatus.ACCEPTED:
      case OrderStatus.PICKED_UP:
      case OrderStatus.IN_TRANSIT:
        orderSentence = pick(locale, {
          ar: "\nالتنفيذ نشط الآن لمُسارية التوصيل. راقب خط التحرّك وسط صفحة التتبع إن وفرت الخريطة.",
          en: "\nFulfillment is in progress; monitor the tracker map when available.",
          he: "\nמשלוח בביצוע; עקוב בעמוד המעקב כשמרחבי המפה פעילים.",
        });
        break;
      default:
        orderSentence = "";
    }
  }

  /** رد بحسب القصد */
  switch (intent) {
    case "TRACK_ORDER":
      return {
        assistantText:
          surface === "customer_public_order" && orderFacts
            ? pick(locale, {
                ar:
                  `لأين طلبك: استخدم بطاقة التتبّع أسفل صفحة الطلب العام لمشاهدة أحدث حالة وحالة المركبة عند الإتاحة. لا أستخدم رمزاً لمسح غير موجود في رابط أو إيصالك.` +
                  orderSentence,
                en:
                  `Open the tracking strip on your public journey page—you should see the freshest status.` +
                  orderSentence,
                he: `השאר בעמוד המעקב הפומבי — שם מתעדכן הסטטוס האחרון.` + orderSentence,
              })
            : pick(locale, {
                ar:
                  "بعد إنشاء الطلب من صفحة الشركة ستصلك أسطر تتبع مع رابط تتبع عام. لم يزل على صفحة «طلب جديد»: أنشئ الطلب أولًا ثم تابع من البطاقة الناتجة أو من رابط الواتساب/التنبيه إن وفّره النظام.",
                en:
                  "After submitting the order you receive a tracker link/snippet — follow that for live status.",
                he: `אחרי מילוי ההזמנה תקבלי קישור/באנר מעקב – זה מה שממשיך מעקב בזמן אמת.`,
              }),
        quickReplies:
          locale === "he"
            ? ["איפה הקישור לעקבות?", "הקוריאר לא מתעדכן", "איך מתלונים?"]
            : locale === "en"
              ? ["Where's my link?", "Map not updating", "How to complain"]
              : ["وين الرابط بعد الطلب?", "الخريطة ما تتحرك", "كيف الشكاوى من صفحة الطلب؟"],
      };

    case "HOW_PUBLIC_ORDER":
      return {
        assistantText: pick(locale, {
          ar:
            bullets("ar", {
              ar: [
                "اختَر المنطقة أو المدينة إن ظهرت في النموذج",
                "أدخل عنوان الاستلام والتسليم وأرقام التواصل",
                "راجع الملخص ثم تأكيد الإنشاء",
                "بعد الإنشاء ستظهر وسيلة تتبع وإمكان اشتراك إشعارات المتصفح إذا فعّلت الشركة ذلك",
              ],
              en: [],
              he: [],
            }),
          en:
            bullets("en", {
              ar: [],
              en: [
                "Choose service area fields when visible",
                "Enter pickup/drop-off details and validated phones",
                "Review the confirmation summary before submit",
                "After submitting, use the tracker strip and optional notifications",
              ],
              he: [],
            }),
          he:
            bullets("he", {
              ar: [],
              en: [],
              he: ["בחירת איזור מהנתונים", "כתובות וטלפונים מאומתים", "סיכום לפני שליחה", "מיד אחר השליחה מתעדכן המעקב"],
            }),
        }),
        quickReplies:
          locale === "en"
            ? ["Why fields invalid?", "How delivery fee?", "Need another order"]
            : locale === "he"
              ? ["למה הנתונים נדחו?", "איך מתעדכנים המחירים?", "להזין הזמנה נוספת"]
              : ["ليش بعض الحقول ترفض?", "كم الرسوم؟", "طلب إضافي"],
      };

    case "ORDER_ISSUE":
      return {
        assistantText:
          surface === "customer_public_order"
            ? pick(locale, {
                ar: "التعديل الآلي للطلبات غير مسموح في هذه القناة لتجنّب أخطاء مالية؛ إن احتاجت ضبط عنوان أو هاتف تواصل بطريقتك مع الشركة. يمكنكم إن وُفّرت في صفحة الطلب عمومًا إرسال شكوى من نفس الواجهة (`شكاوى عمومية`) دون افشاء شركة أخرى.",
                en: "Orders cannot be auto-modified from here; contact the retailer or use any public complaints link their page exposes.",
                he: `שינויים אוטומטיים לא זמינים כאן; פני לצוות המסעדה/החברה או אל ערוץ תלונה שמתפרסם אצלם בעמוד ציבורי.`,
              })
            : pick(locale, {
                ar: "من لوحة التشغيل تقدرون تنقلون الأمور لفريقكم الداخلي: التحقق من بطاقة الطلب، التوزيع أو التواصل مع العميل. لا أفعّّل تنفيذات خطرة من هذا المسار.",
                en: "From the dashboard you coordinate internally—I cannot mutate orders.",
                he: `בלוח שולטים בשיחות ובתהליך — כאן אין הפעלה אוטומטית לשינויים בשדות מסוכנות.`,
              }),
        quickReplies:
          locale === "ar"
            ? ["كيف أبلغ عميل بتأخر؟", "أين قائمة الطلبات؟", "سياسات الإلغاء"]
            : ["How alert customer?", "Open orders tab", "Cancel policy wording"],
      };

    case "CAPTAIN_NOT_VISIBLE":
      return {
        assistantText:
          surface === "customer_public_order" && orderFacts
            ? pick(locale, {
                ar:
                  (orderFacts.status === OrderStatus.ASSIGNED && orderFacts.hasAssignedCaptain
                    ? "في حالة «مسند ومُنتظر قبول»: قد لا تظهر بيانات كاملة قبل أن يؤكّد الكابتن ويُحمِّل التتبع."
                    : "إن لم يُسند بعد، قد تأخّر التعيين بسبب الضغط أو مناطق التغطية. بعد الإسناد والقبول تظهر تفاصيل أغنى حيث تتيح الشركة ذلك.") +
                  orderSentence,
                en:
                  (orderFacts.status === OrderStatus.ASSIGNED && orderFacts.hasAssignedCaptain
                    ? `While awaiting captain acceptance, details stay limited—that's expected. `
                    : `If no courier yet, dispatch may still be searching.`) + orderSentence,
                he:
                  (orderFacts.status === OrderStatus.ASSIGNED && orderFacts.hasAssignedCaptain
                    ? "במהלך ההמתנה לקבלה עשויות פחות הצגות — הרחב ייתכן אחרי הקבלה או מתעדכן מפת המעקב. "
                    : "כשאין שיבוץ בעדיין, ייתכנו טריות עקב עומס. ") + orderSentence,
              })
            : pick(locale, {
                ar: "بمجرد تأكيد التعيين وقبول الكابتن، تتوفر نقاط أفضل أو خريطة مباشرة حسب خطوط الإنتاج؛ لا أفعّّل أو أزيل أسنادًا من هذا المكان.",
                en: "Courier details unlock after routing acceptance when the company publishes them.",
                he: `אחר שהשיבוץ מאושר, ייחשפו מה שמתאים בהגדרות המפעיל.`,
              }),
        quickReplies:
          locale === "ar"
            ? ["وين حالة قبول الكابتن؟", "الخريطة تحت الطلب لماذا فاضية؟", "تأخر فعلًا"]
            : ["Captain acceptance?", "Empty map?", "Feels stalled"],
      };

    case "COMPANY_PROFIT_GENERAL":
      return {
        assistantText:
          surface === "dashboard"
            ? pick(locale, {
                ar: "تربح الشركة من العمولة على التوصيل والفرق بين أسعار الأساس والسياسات المالية المتفق معها؛ أرصدادات تفصيلية تظهر لمَن له صلاحية في بطاقات «المالية» وليس عبر هذا المساعد الذي لا يكشف رصيد شركات أو يعدّله.",
                en: "Operational profit comes from negotiated delivery/markup splits; dashboards surface finance widgets for authorized operators only—assistant cannot mutate balances.",
                he: `רווחי תזרים מתכותבים בשילוב פרמטרים ארגוניים; נתוני עומק מתפרסים בכרטיסי כספים למורשים בלבד – המסייע לא משנה ארנקים.`,
              })
            : pick(locale, {
                ar: "نموذج ربح شركة التجزئة يختلف عبر الأسعار المتفاوض عنها لتشغيل التوصيل — لا أكشف أسعار طرف ثالث لأغراض أمان.",
                en: "Restaurant-specific economics stay private—we only discuss general onboarding topics here.",
                he: `הנחות ההכנסות של הצד המוכר מאובטחות – מתארים כאן מידע מהמסגרת.`,
              }),
        quickReplies:
          surface === "dashboard"
            ? ["أين بطاقات المالية", "سياسات العمولة", "تصدير تقارير"]
            : ["تكلفة التوصيل", "أين شركة أخرى؟"],
      };

    case "DISPATCH_HELP":
      return {
        assistantText:
          surface === "dashboard"
            ? pick(locale, {
                ar: "من تبويب «التوزيع» يمكنك نقل أو إثبات الأسناد اليدوي لمن لديهم صلاحية؛ هذا المساعد لا ينقل طلبًا فعلًا لك، لكن خطوطك العامة: افتح قائمة الأسناد اليدوي، راقب المركبات النشطة، راجع التصفية حسب المتجر أو الحالة قبل التأكيد.",
                en: "Use the Distribution board for manual assignment—this chat only explains; it never dispatches orders.",
                he: `בלשונית ההפצה מבצעים שיבוץ ידני מורשה; כאן רק מדריך בלי שינוי אוטומטי.`,
              })
            : pick(locale, {
                ar: "إدارة التوزيع وإسناد الكباتن تتم من لوحة الشركة لذوي الصلاحية فقط — العميل العام لا يرى قائمة الكباتن.",
                en: "Dispatch is done by staff with permissions; public customers never see that surface.",
                he: `הפצה לשליחים היא לצוות לפי הרשאות; לקוחות ציבוריים אין כאן פרטים רגישים.`,
              }),
        quickReplies: ["الفرق بين الإسناد اليدوي والآلي", "الخريطة لا تتحدث", "تصفية حسب المتجر"],
      };

    case "LOGIN_OR_ACCESS_HELP":
      return {
        assistantText: pick(locale, {
          ar: "من «تسجيل الدخول» استخدم رقم هاتفك المعتمد في النظام ثم رمز التحقق/كلمة السر حسب إعداد مسؤول المنصة. إن رأيت «غير مصرح» فدورك الحالي لا يملك اللوحة.",
          en: "Sign in with the phone your admin provisioned; if you get forbidden, your role may not access the dashboard.",
          he: `התחברות לפי הטלפון שהוגדר; אם יש "אסור" – לתפקיד אין גישה ללוח.`,
        }),
        quickReplies: ["نسيت الرمز", "403 / غير مصرح", "تغيير اللغة"],
      };

    case "CUSTOMER_CONTACT":
      return {
        assistantText: pick(locale, {
          ar: "أفضل قناة للتواصل مع الشركة عبر أرقامها الرسمية أو إن وُجدت نموذج شكوى في صفحة الطلب نفسها — لا أمنح أرقامًا لشركات أخرى.",
          en: "Use the company's phone or complaint form on their public page—no cross-tenant contact data here.",
          he: `לפנות לפי הפרטים המצוינים בעמוד החברה – אין כאן מספרים של חברות אחרות.`,
        }),
        quickReplies: ["حالة الشكوى", "تأكيد الطلب", "دعم تقني"],
      };

    case "SMALLTALK_FALLBACK":
    default:
      return {
        assistantText: pick(locale, {
          ar: "أنا مساعد إرشادي فقط: أشرح التتبع، صفحة الطلب العامة، ولوحة التشغيل دون تنفيذ تغييرات على الطلبات أو الأرصدة.",
          en: "I'm a read-only guide for tracking, public ordering, and dashboard navigation—no dangerous actions.",
          he: `אני מציג מידע ומנחה בלי לשנות הזמנות או יתרות.`,
        }),
        quickReplies:
          locale === "en"
            ? ["Track my order", "How to place order", "Captain not showing"]
            : locale === "he"
              ? ["איפה המשלוח?", "איך מזמינים?", "השליח לא מופיע"]
              : ["وين طلبي؟", "كيف أعمل طلب؟", "ليش الكابتن ما ظهر؟"],
      };
  }
}
