import type { ValueTranslations } from "@/types/api";
import { getLocalizedText } from "@/i18n/localize-dynamic-text";
import type {
  ActiveMapCaptain,
  CaptainListItem,
  OrderListItem,
  StoreListItem,
  StoreSupervisorUser,
  UserListItem,
} from "@/types/api";

/** Captain roster / map — display-only labels (optional API `displayI18n`). */
export function captainUserNameDisplay(c: CaptainListItem | ActiveMapCaptain, lang: string): string {
  return getLocalizedText(c.user.fullName, {
    lang,
    valueTranslations: c.user.displayI18n?.fullName,
    mode: "generic",
  });
}

export function captainAreaDisplay(c: CaptainListItem | ActiveMapCaptain, lang: string): string {
  return getLocalizedText(c.area, {
    lang,
    valueTranslations: c.displayI18n?.area,
    mode: "place",
  });
}

export function captainOptionLabel(c: CaptainListItem, lang: string): string {
  return `${captainUserNameDisplay(c, lang)} — ${captainAreaDisplay(c, lang)}`;
}

export function storeNameDisplay(s: StoreListItem, lang: string): string {
  return getLocalizedText(s.name, { lang, valueTranslations: s.displayI18n?.name, mode: "generic" });
}

export function storeAreaOnly(s: StoreListItem, lang: string): string {
  return getLocalizedText(s.area, { lang, valueTranslations: s.displayI18n?.area, mode: "place" });
}

export function storeOptionLabel(s: StoreListItem, lang: string): string {
  return `${storeNameDisplay(s, lang)} — ${storeAreaOnly(s, lang)}`;
}

export function supervisorNameDisplay(u: NonNullable<StoreSupervisorUser>, lang: string): string {
  return getLocalizedText(u.fullName, { lang, valueTranslations: u.displayI18n?.fullName, mode: "generic" });
}

export function userListItemNameDisplay(u: UserListItem, lang: string): string {
  return getLocalizedText(u.fullName, { lang, valueTranslations: u.displayI18n?.fullName, mode: "generic" });
}

export function primaryRegionLabel(
  region: NonNullable<StoreListItem["primaryRegion"]>,
  lang: string,
  valueTranslations?: ValueTranslations | null,
): string {
  return getLocalizedText(region.name, { lang, valueTranslations: valueTranslations ?? undefined, mode: "place" });
}

export function orderCustomerNameQuick(o: OrderListItem, lang: string): string {
  return getLocalizedText(o.customerName, { lang, valueTranslations: o.displayI18n?.customerName, mode: "generic" });
}

export function resolveCaptainDisplayNameForPending(
  captainId: string,
  mapCaptains: ActiveMapCaptain[],
  roster: CaptainListItem[],
  lang: string,
  fallback: string,
): string {
  const am = mapCaptains.find((c) => c.id === captainId);
  if (am) return captainUserNameDisplay(am, lang);
  const r = roster.find((c) => c.id === captainId);
  if (r) return captainUserNameDisplay(r, lang);
  return fallback;
}
