import type { IncubatorParseResult } from "@/features/incubator-host/parse-incubator-order";

/** مسودة قابلة للتعديل قبل إرسال `CreateOrderPayload`. */
export type IncubatorOrderDraft = {
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  dropoffAddress: string;
  area: string;
  amount: string;
  notes: string;
};

export function emptyDraft(): IncubatorOrderDraft {
  return {
    customerName: "",
    customerPhone: "",
    pickupAddress: "",
    dropoffAddress: "",
    area: "",
    amount: "",
    notes: "",
  };
}

/**
 * يبني مسودة من نتيجة التحليل — يمكن للمشرف تعديل كل حقل قبل الإنشاء.
 * عنوان الاستلام يُشتق من اسم المطعم؛ التسليم من «بالقرب من» والمنطقة.
 */
export function draftFromParsed(parse: IncubatorParseResult): IncubatorOrderDraft {
  const f = parse.fields;
  const phone = (parse.normalizedPhone ?? f.phone ?? "").trim();
  const amountStr = parse.normalizedTotal ?? (f.total?.trim() ?? "");

  const restaurant = f.restaurantName?.trim() ?? "";
  const pickupAddress = restaurant ? `استلام من: ${restaurant}` : "";

  const near = f.nearLocation?.trim() ?? "";
  const ar = f.area?.trim() ?? "";
  /** تسليم: قرب + منطقة؛ إن وُجدت المنطقة فقط نستخدمها كاحتياط آمن لعنوان التسليم. */
  const dropoffAddress = [near, ar].filter(Boolean).join(" — ") || near || ar || "";

  const noteLines: string[] = [];
  if (f.orderNumber?.trim()) noteLines.push(`رقم الطلبية (مرجع): ${f.orderNumber.trim()}`);
  if (f.orderStatus?.trim()) noteLines.push(`حالة (مرجع): ${f.orderStatus.trim()}`);

  return {
    customerName: f.customerName?.trim() ?? "",
    customerPhone: phone,
    pickupAddress,
    dropoffAddress,
    area: ar,
    amount: amountStr,
    notes: noteLines.join("\n"),
  };
}

export type IncubatorDraftValidation = {
  errors: Partial<Record<keyof IncubatorOrderDraft, string>>;
  isValid: boolean;
};

/** مطابقة تقريبية لتحقق نموذج «طلب جديد». */
export function validateIncubatorDraft(d: IncubatorOrderDraft): IncubatorDraftValidation {
  const errors: Partial<Record<keyof IncubatorOrderDraft, string>> = {};

  const customerName = d.customerName.trim();
  const customerPhone = d.customerPhone.trim();
  const pickupAddress = d.pickupAddress.trim();
  const dropoffAddress = d.dropoffAddress.trim();
  const area = d.area.trim();
  const amountRaw = d.amount.replace(",", ".").trim();
  const amount = Number(amountRaw);

  if (!customerName) errors.customerName = "مطلوب.";
  if (!customerPhone) errors.customerPhone = "مطلوب.";
  else if (!/^[\d+\s()-]{5,}$/.test(customerPhone)) {
    errors.customerPhone = "صيغة غير صحيحة.";
  }
  if (!pickupAddress) errors.pickupAddress = "مطلوب.";
  if (!dropoffAddress) errors.dropoffAddress = "مطلوب.";
  if (!area) errors.area = "مطلوب.";
  if (!amountRaw || !Number.isFinite(amount) || amount <= 0) {
    errors.amount = "يجب أن يكون رقماً أكبر من صفر.";
  }

  return { errors, isValid: Object.keys(errors).length === 0 };
}

export const PREVIEW_REQUIRED_LABELS: Record<
  keyof Pick<IncubatorOrderDraft, "customerName" | "customerPhone" | "pickupAddress" | "dropoffAddress" | "area" | "amount">,
  string
> = {
  customerName: "اسم العميل",
  customerPhone: "هاتف العميل",
  pickupAddress: "عنوان الاستلام",
  dropoffAddress: "عنوان التسليم",
  area: "المنطقة",
  amount: "سعر الطلب",
};

const REQUIRED_PREVIEW_KEYS = [
  "customerName",
  "customerPhone",
  "pickupAddress",
  "dropoffAddress",
  "area",
  "amount",
] as const satisfies readonly (keyof IncubatorOrderDraft)[];

/** قائمة أسماء الحقول الإلزامية الناقصة أو غير الصالحة — للعرض السريع. */
export function listInvalidRequiredPreviewFields(d: IncubatorOrderDraft): string[] {
  const { errors } = validateIncubatorDraft(d);
  return REQUIRED_PREVIEW_KEYS.filter((k) => errors[k]).map((k) => PREVIEW_REQUIRED_LABELS[k]);
}
