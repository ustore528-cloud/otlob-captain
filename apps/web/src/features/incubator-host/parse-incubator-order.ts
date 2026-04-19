/**
 * تحليل نص طلب خام من «الأم الحاضنة» — مطابقة بالتسميات العربية وليس بترتيب أسطر ثابت.
 */

export type IncubatorOrderFieldKey =
  | "orderNumber"
  | "customerName"
  | "restaurantName"
  | "orderStatus"
  | "area"
  | "nearLocation"
  | "phone"
  | "total";

export type ParsedIncubatorOrder = Record<IncubatorOrderFieldKey, string | null>;

export type IncubatorParseResult = {
  fields: ParsedIncubatorOrder;
  /** هاتف موحّد (أرقام فقط حيث أمكن) */
  normalizedPhone: string | null;
  /** مبلغ المجموع كنص رقمي عشري (مثلاً 30 أو 30.5) */
  normalizedTotal: string | null;
  /** تحذيرات يجب مراجعتها */
  warnings: string[];
  /** سجل تفصيلي للمشرف */
  log: string[];
};

export const FIELD_LABELS_AR: Record<IncubatorOrderFieldKey, string> = {
  orderNumber: "رقم الطلبية",
  customerName: "اسم العميل",
  restaurantName: "اسم المطعم",
  orderStatus: "حالة الطلبية",
  area: "المنطقة",
  nearLocation: "بالقرب من",
  phone: "رقم الهاتف",
  total: "المجموع",
};

/** ترتيب المطابقة: الأطول أولاً لتقليل التداخل بين التسميات القصيرة والطويلة. */
const FIELD_ALIASES: { key: IncubatorOrderFieldKey; aliases: string[] }[] = [
  { key: "orderNumber", aliases: ["رقم الطلبية", "رقم الطلب"] },
  { key: "customerName", aliases: ["اسم العميل", "العميل", "اسم الزبون"] },
  { key: "restaurantName", aliases: ["اسم المطعم", "المطعم", "اسم المحل"] },
  { key: "orderStatus", aliases: ["حالة الطلبية", "حالة الطلب", "الحالة"] },
  { key: "area", aliases: ["المنطقة", "منطقة"] },
  { key: "nearLocation", aliases: ["بالقرب من", "قرب من", "بالقرب"] },
  { key: "phone", aliases: ["رقم الهاتف", "الهاتف", "الجوال", "الموبايل", "جوال", "موبايل"] },
  { key: "total", aliases: ["المجموع", "الإجمالي", "المبلغ", "السعر الإجمالي", "السعر"] },
];

function emptyFields(): ParsedIncubatorOrder {
  return {
    orderNumber: null,
    customerName: null,
    restaurantName: null,
    orderStatus: null,
    area: null,
    nearLocation: null,
    phone: null,
    total: null,
  };
}

/** إزالة التشكيل، توحيد الألف، تقليل المسافات — للمقارنة بين التسميات فقط. */
export function normalizeArabicForLabelMatch(s: string): string {
  let t = s.trim();
  t = t.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "");
  t = t.replace(/[\u200c\u200f\u202a-\u202e]/g, "");
  t = t.replace(/أ|إ|آ/g, "ا");
  t = t.replace(/ى/g, "ي");
  t = t.replace(/ة(?=\s|$|[\u0600-\u06FF])/g, "ه");
  t = t.replace(/\s+/g, " ");
  return t.trim();
}

function compactForFuzzy(s: string): string {
  return normalizeArabicForLabelMatch(s).replace(/\s/g, "");
}

type AliasCandidate = { key: IncubatorOrderFieldKey; alias: string; norm: string; len: number };

function buildSortedAliasCandidates(): AliasCandidate[] {
  const out: AliasCandidate[] = [];
  for (const { key, aliases } of FIELD_ALIASES) {
    for (const alias of aliases) {
      const norm = normalizeArabicForLabelMatch(alias);
      out.push({ key, alias, norm, len: norm.length });
    }
  }
  out.sort((a, b) => b.len - a.len);
  return out;
}

const SORTED_ALIAS_CANDIDATES = buildSortedAliasCandidates();

function resolveFieldKeyFromLabel(rawLabel: string): IncubatorOrderFieldKey | null {
  const n = normalizeArabicForLabelMatch(rawLabel);
  const nCompact = compactForFuzzy(rawLabel);

  for (const c of SORTED_ALIAS_CANDIDATES) {
    const a = c.norm;
    const aCompact = compactForFuzzy(c.alias);
    if (n === a || nCompact === aCompact) {
      return c.key;
    }
  }

  for (const c of SORTED_ALIAS_CANDIDATES) {
    const a = c.norm;
    if (n.startsWith(a) && (n.length === a.length || /\s/.test(n[a.length] ?? ""))) {
      return c.key;
    }
  }

  for (const c of SORTED_ALIAS_CANDIDATES) {
    const a = c.norm;
    if (a.length >= 4 && n.includes(a)) {
      return c.key;
    }
  }

  return null;
}

function normalizeInputText(raw: string): string {
  return raw.replace(/\r\n/g, "\n").replace(/\u00a0/g, " ");
}

function splitLabelValue(line: string): { label: string; value: string } | null {
  const m = line.match(/^([^:：]+)[:：]\s*(.*)$/);
  if (!m) return null;
  return { label: m[1].trim(), value: m[2].trim() };
}

function looksLikeLabeledLine(line: string): boolean {
  return /^[^:：\n]{1,80}[:：]/.test(line.trim());
}

function appendSegment(prev: string | null, segment: string): string {
  const s = segment.trim();
  if (!s) return prev ?? "";
  if (!prev) return s;
  return `${prev} ${s}`;
}

function cleanupValue(s: string | null): string | null {
  if (s == null) return null;
  const t = s.replace(/\s+/g, " ").trim();
  return t.length ? t : null;
}

const AR_DIGIT = "٠١٢٣٤٥٦٧٨٩";
const EN_DIGIT = "0123456789";

function arabicIndicDigitsToAscii(s: string): string {
  let out = "";
  for (const ch of s) {
    const i = AR_DIGIT.indexOf(ch);
    out += i >= 0 ? EN_DIGIT[i]! : ch;
  }
  return out;
}

/** أرقام فقط مع الإبقاء على بادئة دولية معقولة */
export function normalizePhoneDigits(input: string | null): string | null {
  if (input == null) return null;
  let s = arabicIndicDigitsToAscii(input).trim();
  s = s.replace(/[\s().\-/]/g, "");
  const digits = s.replace(/\D/g, "");
  if (!digits.length) return null;
  return digits;
}

/** استخراج رقم عشري من نص يحتوي عملات ورموز */
export function normalizeAmountText(input: string | null): string | null {
  if (input == null) return null;
  let s = arabicIndicDigitsToAscii(input);
  s = s.replace(/[₪$€£﷼]/g, " ");
  s = s.replace(/,/g, ".");
  s = s.replace(/\s+/g, " ").trim();
  const m = s.match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return null;
  return m[0].replace(",", ".");
}

/**
 * يحلّل النص الخام ويملأ الحقول المعروفة. أسطر بلا «:» تُلحق بآخر حقل إن وُجد.
 */
export function parseIncubatorRawOrder(raw: string): IncubatorParseResult {
  const warnings: string[] = [];
  const log: string[] = [];
  const fields = emptyFields();

  const text = normalizeInputText(raw);
  if (!text.trim()) {
    log.push("المدخل فارغ — لا يوجد ما يُحلَّل.");
    return {
      fields,
      normalizedPhone: null,
      normalizedTotal: null,
      warnings: [],
      log,
    };
  }

  const lines = text.split("\n");
  let currentKey: IncubatorOrderFieldKey | null = null;

  for (let i = 0; i < lines.length; i++) {
    const lineRaw = lines[i];
    const line = lineRaw.trim();
    if (!line) {
      log.push(`سطر ${i + 1}: فارغ — تُجاهل.`);
      continue;
    }

    const lv = splitLabelValue(line);
    if (lv) {
      const key = resolveFieldKeyFromLabel(lv.label);
      if (key) {
        const prev = fields[key];
        fields[key] = appendSegment(prev, lv.value);
        currentKey = key;
        log.push(`سطر ${i + 1}: عُرِف الحقل «${FIELD_LABELS_AR[key]}» من التسمية «${lv.label}».`);
      } else {
        const msg = `سطر ${i + 1}: تسمية غير معروفة «${lv.label}» — لم يُعثر على حقل مطابق.`;
        warnings.push(msg);
        log.push(msg);
        if (currentKey) {
          fields[currentKey] = appendSegment(fields[currentKey], lv.value);
          log.push(`→ أُلحق قيمة السطر بالحقل الحالي «${FIELD_LABELS_AR[currentKey]}» (تسمية غير معروفة).`);
        }
      }
      continue;
    }

    if (looksLikeLabeledLine(line)) {
      const w = `سطر ${i + 1}: يبدو كحقل لكن لم يُستخرج تسمية/قيمة بشكل صالح: ${line.slice(0, 72)}${line.length > 72 ? "…" : ""}`;
      warnings.push(w);
      log.push(w);
    }

    if (currentKey) {
      fields[currentKey] = appendSegment(fields[currentKey], line);
      log.push(`سطر ${i + 1}: تابع — أُلحق بـ «${FIELD_LABELS_AR[currentKey]}».`);
    } else {
      const w = `سطر ${i + 1}: نص بدون تسمية ولا حقل سابق — تُجاهل: ${line.slice(0, 80)}${line.length > 80 ? "…" : ""}`;
      warnings.push(w);
      log.push(w);
    }
  }

  (Object.keys(fields) as IncubatorOrderFieldKey[]).forEach((k) => {
    fields[k] = cleanupValue(fields[k]);
  });

  const normalizedPhone = normalizePhoneDigits(fields.phone);
  const normalizedTotal = normalizeAmountText(fields.total);

  if (fields.phone && !normalizedPhone) {
    const w = "فشل توحيد رقم الهاتف — راجع القيمة المستخرجة.";
    warnings.push(w);
    log.push(w);
  }
  if (fields.total && !normalizedTotal) {
    const w = "فشل استخراج المبلغ من «المجموع» — راجع القيمة المستخرجة.";
    warnings.push(w);
    log.push(w);
  }

  const missing = (Object.keys(fields) as IncubatorOrderFieldKey[]).filter((k) => !fields[k]);
  if (missing.length) {
    log.push(`ملخص: لم تُستخرج قيم للحقول: ${missing.map((k) => FIELD_LABELS_AR[k]).join("، ")}.`);
  } else {
    log.push("ملخص: جميع الحقول المعروفة لها قيم.");
  }

  return {
    fields,
    normalizedPhone,
    normalizedTotal,
    warnings,
    log,
  };
}
