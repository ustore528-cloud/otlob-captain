import { z } from "zod";



/** حقول أساسية — للشرائح النصّية القديمة دون صورة */

const LegacySlidePartsSchema = z.object({

  id: z.string().min(1).max(64),

  title: z.string().min(1).max(280),

  badge: z.string().max(120).optional(),

  emoji: z.string().max(12).optional(),

});



/** شريحة صورة HTTPS — SUPER_ADMIN يضبطها لكل شركة */

export const CarouselImageSlidePatchSchema = z.object({

  id: z.string().min(1).max(64),

  imageUrl: z

    .string()

    .url()

    .max(2048)

    .refine((u) => u.startsWith("https://"), "imageUrl must be HTTPS"),

  alt: z.string().max(200).optional(),

});



/** إعدادات صفحة الطلب — بدون carouselSlides؛ إدارة الشرائح المصوّرة فقط من مسار SUPER_ADMIN المنفصل. */

export const PublicPageSettingsPatchSchema = z

  .object({

    introTitle: z.string().max(240).nullable().optional(),

    introSubtitle: z.string().max(500).nullable().optional(),

    showCarousel: z.boolean().optional(),

    showComplaintsBox: z.boolean().optional(),

    showBenefitsRow: z.boolean().optional(),

    bannerWelcome: z.string().max(400).nullable().optional(),

    nearbyCaption: z.string().max(280).nullable().optional(),

    /** نصف القطر الذي تُعرض فيه نقاط الكباتن على خريطة العميل */

    nearbyRadiusKm: z.union([z.number().min(2).max(25), z.null()]).optional(),

    /** نص تنبيه أسفل شريحة الإعلانات */

    orderButtonHint: z.string().max(200).nullable().optional(),

  })

  .strict();



export type PublicPageSettingsPatch = z.infer<typeof PublicPageSettingsPatchSchema>;



export const PublicPageCarouselSlidesPatchSchema = z

  .object({

    carouselSlides: z.array(CarouselImageSlidePatchSchema).max(12),

  })

  .strict();



export type PublicPageCarouselSlidesPatch = z.infer<typeof PublicPageCarouselSlidesPatchSchema>;



export type CarouselImageSlideNormalized = {

  id: string;

  imageUrl: string;

  alt: string;

};



export type ResolvedPublicPageSettings = {

  introTitle: string;

  introSubtitle: string | null;

  carouselSlides: Array<{

    id: string;

    /** موجودة ⇒ عرض سليد الصورة */

    imageUrl: string | null;

    /** نص بديل لصورة السليد أو سليد قديم */

    alt: string;

    title: string;

    badge: string;

    emoji: string;

    /** فهرس لتدرّج واجهة الطلب؛ يُستخدم فقط عند عدم وجود صورة */

    centerBg: string;

  }>;

  showCarousel: boolean;

  showComplaintsBox: boolean;

  showBenefitsRow: boolean;

  bannerWelcome: string | null;

  nearbyCaption: string | null;

  nearbyRadiusKm: number;

  orderButtonHint: string | null;

};



const GRADS = [

  "from-[color:var(--brand-primary-dark)] via-primary to-[color:var(--brand-primary)]",

  "from-emerald-700 via-teal-600 to-cyan-600",

  "from-violet-700 via-indigo-600 to-blue-700",

];



function gradientForIndex(i: number): string {

  const g = GRADS[i % GRADS.length];

  return g ?? GRADS[0]!;

}



/** قيم افتراضية لواجهة صفحة الطلب العام */

export function defaultPublicPageSettings(): ResolvedPublicPageSettings {

  return {

    introTitle: "خدمة توصيل",

    introSubtitle: "حدّد عنوان الاستلام والتسليم، وسنوصل طلبك بأسرع وقت.",

    carouselSlides: [],

    showCarousel: true,

    showComplaintsBox: true,

    showBenefitsRow: true,

    bannerWelcome: null,

    nearbyCaption: "كباتن قريبون من موقعك (تقريباً)",

    nearbyRadiusKm: 5,

    orderButtonHint: null,

  };

}



/** دمج مخزَّن مع الافتراضي — حقول فارغة تُعتبر مطلقة للحذف من العرض حيث ينطبق */

export function resolvePublicPageSettings(raw: unknown | null | undefined): ResolvedPublicPageSettings {

  const defaults = defaultPublicPageSettings();

  if (raw === null || raw === undefined) return defaults;

  const obj =

    typeof raw === "object" && raw !== null && !Array.isArray(raw)

      ? (raw as Record<string, unknown>)

      : {};



  let carouselSlides = defaults.carouselSlides;

  const slidesIn = obj.carouselSlides;

  if (Array.isArray(slidesIn) && slidesIn.length > 0) {

    const parsed: ResolvedPublicPageSettings["carouselSlides"] = [];

    for (let i = 0; i < slidesIn.length; i++) {

      const s = slidesIn[i];

      if (!s || typeof s !== "object") continue;

      const r = s as Record<string, unknown>;

      const id = typeof r.id === "string" ? r.id : `s${i}`;



      const imageRaw = typeof r.imageUrl === "string" ? r.imageUrl.trim() : "";

      if (imageRaw.startsWith("https://")) {

        parsed.push({

          id,

          imageUrl: imageRaw.slice(0, 2048),

          alt:

            typeof r.alt === "string"

              ? r.alt.slice(0, 200)

              : typeof r.title === "string"

                ? r.title.slice(0, 200)

                : "",

          title: "",

          badge: "",

          emoji: "",

          centerBg: "",

        });

        continue;

      }



      let legacy: import("zod").infer<typeof LegacySlidePartsSchema> | undefined;

      try {

        legacy = LegacySlidePartsSchema.parse(r);

      } catch {

        const titleGuess = typeof r.title === "string" ? r.title : "";

        if (!titleGuess.trim()) continue;

        legacy = {

          id,

          title: titleGuess,

          badge: typeof r.badge === "string" ? r.badge : "عرض",

          emoji: typeof r.emoji === "string" ? r.emoji : "",

        };

      }



      parsed.push({

        id: legacy.id,

        imageUrl: null,

        alt: "",

        title: legacy.title.slice(0, 280),

        badge: (legacy.badge ?? "عرض").slice(0, 120),

        emoji: (legacy.emoji ?? "").slice(0, 12),

        centerBg: gradientForIndex(parsed.length),

      });

    }

    if (parsed.length > 0) carouselSlides = parsed;

  }



  const nearbyRadiusKm =

    typeof obj.nearbyRadiusKm === "number" &&

    Number.isFinite(obj.nearbyRadiusKm) &&

    obj.nearbyRadiusKm >= 2 &&

    obj.nearbyRadiusKm <= 25

      ? obj.nearbyRadiusKm

      : defaults.nearbyRadiusKm;



  return {

    introTitle:

      typeof obj.introTitle === "string" && obj.introTitle.trim() !== ""

        ? obj.introTitle.slice(0, 240)

        : defaults.introTitle,

    introSubtitle:

      typeof obj.introSubtitle === "string" ? obj.introSubtitle.slice(0, 500) || null : defaults.introSubtitle,

    carouselSlides,

    showCarousel: typeof obj.showCarousel === "boolean" ? obj.showCarousel : defaults.showCarousel,

    showComplaintsBox:

      typeof obj.showComplaintsBox === "boolean" ? obj.showComplaintsBox : defaults.showComplaintsBox,

    showBenefitsRow:

      typeof obj.showBenefitsRow === "boolean" ? obj.showBenefitsRow : defaults.showBenefitsRow,

    bannerWelcome: typeof obj.bannerWelcome === "string" ? obj.bannerWelcome.slice(0, 400) || null : null,

    nearbyCaption:

      typeof obj.nearbyCaption === "string" && obj.nearbyCaption.trim() !== ""

        ? obj.nearbyCaption.slice(0, 280)

        : defaults.nearbyCaption,

    nearbyRadiusKm,

    orderButtonHint:

      typeof obj.orderButtonHint === "string" ? obj.orderButtonHint.slice(0, 200) || null : defaults.orderButtonHint,

  };

}



/** دمج PATCH على JSON خام مخزَّن قبل الحفظ — بدون carouselSlides (يُحمّله مسار SUPER_ADMIN المنفصل). */

export function mergePublicPageStoredJson(

  raw: unknown | null | undefined,

  patch: PublicPageSettingsPatch,

): Record<string, unknown> {

  const base: Record<string, unknown> =

    typeof raw === "object" && raw !== null && !Array.isArray(raw) ? { ...(raw as Record<string, unknown>) } : {};



  function setOrDelete<K extends keyof PublicPageSettingsPatch>(key: K, val: PublicPageSettingsPatch[K]): void {

    if (val === undefined) return;

    if (val === null) {

      Reflect.deleteProperty(base, key as string);

      return;

    }

    base[key as string] = val as unknown;

  }



  setOrDelete("introTitle", patch.introTitle);

  setOrDelete("introSubtitle", patch.introSubtitle);

  setOrDelete("showCarousel", patch.showCarousel);

  setOrDelete("showComplaintsBox", patch.showComplaintsBox);

  setOrDelete("showBenefitsRow", patch.showBenefitsRow);

  setOrDelete("bannerWelcome", patch.bannerWelcome);

  setOrDelete("nearbyCaption", patch.nearbyCaption);

  setOrDelete("nearbyRadiusKm", patch.nearbyRadiusKm);

  setOrDelete("orderButtonHint", patch.orderButtonHint);



  return base;

}



/** استبدال كامل شرائح الصورة فقط في JSON مخزَّن */

export function mergeCarouselSlidesStoredJson(

  raw: unknown | null | undefined,

  slides: CarouselImageSlideNormalized[],

): Record<string, unknown> {

  const base: Record<string, unknown> =

    typeof raw === "object" && raw !== null && !Array.isArray(raw) ? { ...(raw as Record<string, unknown>) } : {};

  base.carouselSlides = slides.map((s) => ({

    id: s.id,

    imageUrl: s.imageUrl,

    ...(s.alt.trim() !== "" ? { alt: s.alt } : {}),

  }));

  return base;

}


