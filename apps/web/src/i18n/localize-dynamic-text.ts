import type { ValueTranslations } from "@/types/api";

/**
 * Display-only localization for free text from orders/stores (does not change API payloads or DB).
 *
 * Backend follow-up (proposal): attach optional per-field JSON on read models, e.g.
 * `customerNameI18n: { en, ar, he }`, or a normalized `entity_translations` table keyed by
 * (entity, field, locale) with the canonical string in the main table unchanged.
 */
export type DisplayLang = "en" | "ar" | "he";

export type LocalizeTextMode = "generic" | "place" | "address";

export function resolveDisplayLang(lang: string | undefined): DisplayLang {
  const b = (lang || "en").split("-")[0].toLowerCase();
  if (b === "ar" || b === "he" || b === "en") return b;
  return "en";
}

function pickValueTranslation(
  t: ValueTranslations | null | undefined,
  displayLang: DisplayLang,
): string | null {
  if (!t) return null;
  const v = t[displayLang];
  if (v != null && String(v).trim() !== "") return String(v);
  return null;
}

/** Arabic script range (broad) — used to apply place dictionary only when useful. */
export function hasArabicScript(s: string): boolean {
  return /[\u0600-\u06FF]/.test(s);
}

function lightTrim(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

type PlaceEntry = { en: string; he: string; ar: string[] };

/**
 * Common Israeli / Palestinian service-area names.
 * Substring replacement in `address` mode uses longest `ar` variants first to reduce collisions.
 */
const KNOWN_PLACES: readonly PlaceEntry[] = [
  { en: "Jerusalem", he: "ירושלים", ar: ["القدس", "بيت المقدس", "اورشليم"] },
  { en: "Ramallah", he: "רמאללה", ar: ["رام الله", "رامالله"] },
  { en: "Gaza", he: "עזה", ar: ["غزة", "غزه", "غزّة"] },
  { en: "Hebron", he: "חברון", ar: ["الخليل", "الخليل البلد"] },
  { en: "Bethlehem", he: "בית לחם", ar: ["بيت لحم", "بيت لحْم"] },
  { en: "Nablus", he: "שכם", ar: ["نابلس", "نابلس البلد"] },
  { en: "Jenin", he: "ג'נין", ar: ["جنين", "جنین"] },
  { en: "Tulkarm", he: "טולכרם", ar: ["طولكرم", "طول كرم", "طولکرم"] },
  { en: "Qalqilya", he: "קלקיליה", ar: ["قلقيلية", "قَلْقِيلِيَة", "القلقيلية"] },
  { en: "Salfit", he: "סלפית", ar: ["سلفيت", "سَلْفِيت", "مُحَافَظَة سلفيت"] },
  { en: "Tubas", he: "טובאס", ar: ["طوباس", "مُحَافَظَة طوباس"] },
  { en: "Jericho", he: "יריחו", ar: ["أريحا", "الأغوار"] },
  { en: "Tel Aviv", he: "תל אביב", ar: ["تل أبيب", "تل ابيب", "تل-أبيب", "تَلْ أبِيب"] },
  { en: "Haifa", he: "חיפה", ar: ["حيفا", "حیفا"] },
  { en: "Beersheba", he: "באר שבע", ar: ["بئر السبع", "بير السبع", "بئير السبع", "بئر السٌبع"] },
  { en: "Ashdod", he: "אשדוד", ar: ["أشدود", "اسدود"] },
  { en: "Ashkelon", he: "אשקלון", ar: ["عسقلان", "عشقلان"] },
  { en: "Rishon LeZion", he: "רישון לציון", ar: ["ريشون ليتسيون", "رِيشون لِتْسِيُون", "رشون لصيون"] },
  { en: "Petah Tikva", he: "פתח תקווה", ar: ["بتاح تكفا", "بتاح تكڤا", "بيتاح تكفا", "بِتَاح تِقْوَا"] },
  { en: "Bnei Brak", he: "בני ברק", ar: ["بني براك", "بنى بْرَق", "بني بِراق"] },
  { en: "Holon", he: "חולון", ar: ["حولون", "هُولون"] },
  { en: "Netanya", he: "נתניה", ar: ["نِتانْيا", "نَتَنْيَا", "نيتانيا"] },
  { en: "Nazareth", he: "נצרת", ar: ["الناصرة", "ناصرة", "النَاصِرَة", "نَاصِرَة"] },
  { en: "Acre", he: "עכו", ar: ["عكا", "عَكّا", "عَكا"] },
  { en: "Jaffa", he: "יפו", ar: ["يافا", "يَافَا", "يَافا"] },
  { en: "Herzliya", he: "הרצליה", ar: ["هرتسليا", "هِرْتْسْلِيَا", "هرتسلیة"] },
  { en: "Kfar Saba", he: "כפר סבא", ar: ["كفار سابا", "كفارسابا"] },
  { en: "Ra'anana", he: "רעננה", ar: ["رعنانا", "رعنانا"] },
  { en: "Umm al-Fahm", he: "אום אל-פחם", ar: ["أم الفحم", "أم الفٌحْم", "اُم الْفَحْم"] },
  { en: "Rahat", he: "רהט", ar: ["رهط", "رَهط"] },
  { en: "Eilat", he: "אילת", ar: ["إيلات", "أيلة", "أيلت"] },
  { en: "Giv'atayim", he: "גבעתיים", ar: ["جفعاتايم", "غبعاتايم"] },
  { en: "Rehovot", he: "רחובות", ar: ["رحوڤوت", "رحوفوت", "رِحُوفُوت", "رَحَوَفُت"] },
  { en: "Yavne", he: "יבנה", ar: ["يڤني", "ياڤنيه", "یَڤنِی"] },
  { en: "Kiryat Ata", he: "קרית אתא", ar: ["قريت أتا", "كريات عطا", "کریات عطا"] },
  { en: "Hadera", he: "חדרה", ar: ["هديرا", "هَدِیْرَا", "هَدِرَا"] },
  { en: "Beit Shemesh", he: "בית שמש", ar: ["بيت شمش", "بيتشيمِش", "بيتشيمِیش"] },
  { en: "Gedera", he: "גדרה", ar: ["جديرا", "غديرا"] },
  { en: "Kfar Qasim", he: "כפר קאסם", ar: ["كفر قاسم", "کفر کاسم"] },
  { en: "Lod", he: "לוד", ar: ["اللد", "لد"] },
  { en: "Ramle", he: "רמלה", ar: ["الرملة", "رملا", "رَمْلَا"] },
  { en: "Mevasseret Zion", he: "מבשרת ציון", ar: ["مڤسرت تسيون", "مبصرت تسيون", "مبصرت صهيون", "مَبْصَرَت", "مَبۡسَرَت"] },
];

/** Precomputed: all Arabic substrings, longest first. */
const AR_PLACE_PATTERNS: { ar: string; en: string; he: string }[] = (() => {
  const out: { ar: string; en: string; he: string }[] = [];
  for (const p of KNOWN_PLACES) {
    for (const ar of p.ar) {
      const t = ar.trim();
      if (t) out.push({ ar: t, en: p.en, he: p.he });
    }
  }
  out.sort((a, b) => b.ar.length - a.ar.length);
  return out;
})();

const EXACT_PLACE_BY_AR: Map<string, { en: string; he: string }> = (() => {
  const m = new Map<string, { en: string; he: string }>();
  for (const p of KNOWN_PLACES) {
    for (const ar of p.ar) {
      const k = lightTrim(ar);
      if (!k) continue;
      m.set(k, { en: p.en, he: p.he });
    }
  }
  return m;
})();

function lookupPlaceExact(text: string, displayLang: DisplayLang): string | null {
  if (displayLang === "ar") return null;
  const k = lightTrim(text);
  const hit = EXACT_PLACE_BY_AR.get(k);
  if (!hit) return null;
  return displayLang === "he" ? hit.he : hit.en;
}

/**
 * Replaces known Arabic place tokens in longer address strings. Safe, offline; may miss edge spellings.
 */
function applyPlaceSubstringsToAddress(text: string, displayLang: DisplayLang): string {
  if (displayLang === "ar" || !hasArabicScript(text)) return text;
  let out = text;
  for (const { ar, en, he } of AR_PLACE_PATTERNS) {
    if (!ar || !out.includes(ar)) continue;
    const rep = displayLang === "he" ? he : en;
    if (ar === rep) continue;
    out = out.split(ar).join(rep);
  }
  return out;
}

export function getLocalizedText(
  original: string | null | undefined,
  options: {
    lang: string;
    valueTranslations?: ValueTranslations | null;
    /**
     * - generic: optional API `valueTranslations` only (names, store titles — no place dictionary).
     * - place: exact + dictionary for single-line area/city/region.
     * - address: `valueTranslations` first, else substring place dictionary for known Arabic toponyms.
     */
    mode?: LocalizeTextMode;
  },
): string {
  const mode: LocalizeTextMode = options.mode ?? "generic";
  const o = original == null ? "" : String(original);
  if (!o.trim()) return "";
  const displayLang = resolveDisplayLang(options.lang);
  const tr = pickValueTranslation(options.valueTranslations, displayLang);
  if (tr) return tr;
  if (displayLang === "ar") return o;
  if (mode === "generic") return o;
  if (mode === "place") {
    const exact = lookupPlaceExact(o, displayLang);
    if (exact) return exact;
    if (hasArabicScript(o)) return applyPlaceSubstringsToAddress(o, displayLang);
    return o;
  }
  if (mode === "address") {
    if (hasArabicScript(o)) return applyPlaceSubstringsToAddress(o, displayLang);
    return o;
  }
  return o;
}

/**
 * Binds the current i18n language. Use this from React components; pass `i18n.language` in non-React code
 * (e.g. map popups) without importing React.
 */
export function getLocalizedTextWithLang(
  lang: string,
): (original: string | null | undefined, opts: Omit<Parameters<typeof getLocalizedText>[1], "lang">) => string {
  return (original, opts) => getLocalizedText(original, { ...opts, lang });
}
