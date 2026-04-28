import type { IncubatorParseResult } from "@/features/incubator-host/parse-incubator-order";
import i18n from "@/i18n/i18n";

/** Editable draft before sending `CreateOrderPayload`. */
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
 * Builds a draft from parse result — the supervisor can edit any field before create.
 * Pickup is derived from the restaurant name; drop-off from “near” and area.
 */
export function draftFromParsed(parse: IncubatorParseResult): IncubatorOrderDraft {
  const f = parse.fields;
  const phone = (parse.normalizedPhone ?? f.phone ?? "").trim();
  const amountStr = parse.normalizedTotal ?? (f.total?.trim() ?? "");

  const restaurant = f.restaurantName?.trim() ?? "";
  const pickupAddress = restaurant ? String(i18n.t("incubator.draft.pickupFrom", { name: restaurant })) : "";

  const near = f.nearLocation?.trim() ?? "";
  const ar = f.area?.trim() ?? "";
  const dropoffAddress = [near, ar].filter(Boolean).join(" — ") || near || ar || "";

  const noteLines: string[] = [];
  if (f.orderNumber?.trim()) {
    noteLines.push(String(i18n.t("incubator.draft.notesOrderRef", { value: f.orderNumber.trim() })));
  }
  if (f.orderStatus?.trim()) {
    noteLines.push(String(i18n.t("incubator.draft.notesStatusRef", { value: f.orderStatus.trim() })));
  }

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

/** Similar validation to the new-order form. */
export function validateIncubatorDraft(d: IncubatorOrderDraft): IncubatorDraftValidation {
  const errors: Partial<Record<keyof IncubatorOrderDraft, string>> = {};

  const customerName = d.customerName.trim();
  const customerPhone = d.customerPhone.trim();
  const pickupAddress = d.pickupAddress.trim();
  const dropoffAddress = d.dropoffAddress.trim();
  const area = d.area.trim();
  const amountRaw = d.amount.replace(",", ".").trim();
  const amount = Number(amountRaw);

  if (!customerName) errors.customerName = String(i18n.t("incubator.validation.required"));
  if (!customerPhone) errors.customerPhone = String(i18n.t("incubator.validation.required"));
  else if (!/^[\d+\s()-]{5,}$/.test(customerPhone)) {
    errors.customerPhone = String(i18n.t("incubator.validation.phoneFormat"));
  }
  if (!pickupAddress) errors.pickupAddress = String(i18n.t("incubator.validation.required"));
  if (!dropoffAddress) errors.dropoffAddress = String(i18n.t("incubator.validation.required"));
  if (!area) errors.area = String(i18n.t("incubator.validation.required"));
  if (!amountRaw || !Number.isFinite(amount) || amount <= 0) {
    errors.amount = String(i18n.t("incubator.validation.amountPositive"));
  }

  return { errors, isValid: Object.keys(errors).length === 0 };
}

const REQUIRED_PREVIEW_KEYS = [
  "customerName",
  "customerPhone",
  "pickupAddress",
  "dropoffAddress",
  "area",
  "amount",
] as const satisfies readonly (keyof IncubatorOrderDraft)[];

export function previewFieldLabel(
  k: (typeof REQUIRED_PREVIEW_KEYS)[number],
): string {
  return String(i18n.t(`incubator.fieldLabels.${k}`));
}

/** Quick list of missing/invalid required preview fields. */
export function listInvalidRequiredPreviewFields(d: IncubatorOrderDraft): string[] {
  const { errors } = validateIncubatorDraft(d);
  return REQUIRED_PREVIEW_KEYS.filter((k) => errors[k]).map((k) => previewFieldLabel(k));
}
