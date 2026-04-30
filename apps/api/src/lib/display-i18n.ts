import type { Prisma } from "@prisma/client";
import type { ValueTranslations } from "@captain/shared";

function parseLocaleTriplet(raw: unknown): ValueTranslations | undefined {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const pick = (k: "ar" | "en" | "he") => {
    if (!(k in o)) return undefined;
    const v = o[k];
    if (v === null) return null;
    if (typeof v === "string") return v;
    return undefined;
  };
  const ar = pick("ar");
  const en = pick("en");
  const he = pick("he");
  if (ar === undefined && en === undefined && he === undefined) return undefined;
  const out: ValueTranslations = {};
  if (ar !== undefined) out.ar = ar;
  if (en !== undefined) out.en = en;
  if (he !== undefined) out.he = he;
  return out;
}

function nonEmptyRecord<T extends Record<string, unknown>>(o: T): T | undefined {
  return Object.keys(o).length ? o : undefined;
}

/** Parses `display_i18n` JSON from `users`. */
export function userDisplayI18nFromJson(
  json: Prisma.JsonValue | null | undefined,
): { fullName?: ValueTranslations } | undefined {
  if (json == null || typeof json !== "object" || Array.isArray(json)) return undefined;
  const fn = parseLocaleTriplet((json as { fullName?: unknown }).fullName);
  return fn ? nonEmptyRecord({ fullName: fn }) : undefined;
}

export function companyDisplayI18nFromJson(
  json: Prisma.JsonValue | null | undefined,
): { name?: ValueTranslations } | undefined {
  if (json == null || typeof json !== "object" || Array.isArray(json)) return undefined;
  const name = parseLocaleTriplet((json as { name?: unknown }).name);
  return name ? nonEmptyRecord({ name }) : undefined;
}

export function storeDisplayI18nFromJson(
  json: Prisma.JsonValue | null | undefined,
): {
  name?: ValueTranslations;
  area?: ValueTranslations;
  address?: ValueTranslations;
  primaryRegionName?: ValueTranslations;
} | undefined {
  if (json == null || typeof json !== "object" || Array.isArray(json)) return undefined;
  const o = json as Record<string, unknown>;
  const name = parseLocaleTriplet(o.name);
  const area = parseLocaleTriplet(o.area);
  const address = parseLocaleTriplet(o.address);
  const primaryRegionName = parseLocaleTriplet(o.primaryRegionName);
  return nonEmptyRecord({
    ...(name ? { name } : {}),
    ...(area ? { area } : {}),
    ...(address ? { address } : {}),
    ...(primaryRegionName ? { primaryRegionName } : {}),
  });
}

export function regionDisplayI18nFromJson(
  json: Prisma.JsonValue | null | undefined,
): { name?: ValueTranslations } | undefined {
  if (json == null || typeof json !== "object" || Array.isArray(json)) return undefined;
  const name = parseLocaleTriplet((json as { name?: unknown }).name);
  return name ? nonEmptyRecord({ name }) : undefined;
}

export function captainDisplayI18nFromJson(
  json: Prisma.JsonValue | null | undefined,
): { area?: ValueTranslations } | undefined {
  if (json == null || typeof json !== "object" || Array.isArray(json)) return undefined;
  const area = parseLocaleTriplet((json as { area?: unknown }).area);
  return area ? nonEmptyRecord({ area }) : undefined;
}

export function notificationDisplayI18nFromJson(
  json: Prisma.JsonValue | null | undefined,
): { title?: ValueTranslations; body?: ValueTranslations } | undefined {
  if (json == null || typeof json !== "object" || Array.isArray(json)) return undefined;
  const o = json as Record<string, unknown>;
  const title = parseLocaleTriplet(o.title);
  const body = parseLocaleTriplet(o.body);
  return nonEmptyRecord({
    ...(title ? { title } : {}),
    ...(body ? { body } : {}),
  });
}
