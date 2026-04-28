import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { OrderDetail, OrderListItem } from "@/types/api";
import { getLocalizedText, type LocalizeTextMode } from "./localize-dynamic-text";

function dOf(o: OrderListItem | OrderDetail) {
  return o.displayI18n;
}

export function useLocalizedOrderListItem(order: OrderListItem) {
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? i18n.language;
  return useMemo(() => {
    const d = dOf(order);
    const supervisor = order.store.supervisorUser
      ? getLocalizedText(order.store.supervisorUser.fullName, {
          lang,
          valueTranslations: d?.supervisorName ?? order.store.supervisorUser.displayI18n?.fullName,
          mode: "generic" satisfies LocalizeTextMode,
        })
      : null;
    const pr = order.store.primaryRegion;
    return {
      customerName: getLocalizedText(order.customerName, {
        lang,
        valueTranslations: d?.customerName,
        mode: "generic",
      }),
      area: getLocalizedText(order.area, { lang, valueTranslations: d?.area, mode: "place" }),
      pickupAddress: getLocalizedText(order.pickupAddress, {
        lang,
        valueTranslations: d?.pickupAddress,
        mode: "address",
      }),
      dropoffAddress: getLocalizedText(order.dropoffAddress, {
        lang,
        valueTranslations: d?.dropoffAddress,
        mode: "address",
      }),
      storeName: getLocalizedText(order.store.name, {
        lang,
        valueTranslations: d?.storeName,
        mode: "generic",
      }),
      storeArea: getLocalizedText(order.store.area, { lang, valueTranslations: d?.storeArea, mode: "place" }),
      primaryRegionName:
        pr == null
          ? null
          : getLocalizedText(pr.name, {
              lang,
              valueTranslations: d?.primaryRegionName,
              mode: "place",
            }),
      supervisorName: supervisor,
      notes:
        order.notes == null || !String(order.notes).trim()
          ? null
          : getLocalizedText(order.notes, { lang, valueTranslations: d?.notes, mode: "address" }),
      assignedCaptainName: order.assignedCaptain
        ? getLocalizedText(order.assignedCaptain.user.fullName, {
            lang,
            valueTranslations: d?.assignedCaptainName ?? order.assignedCaptain.user.displayI18n?.fullName,
            mode: "generic",
          })
        : null,
    };
  }, [order, lang]);
}

export function useLocalizedOrderDetail(order: OrderDetail) {
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? i18n.language;
  return useMemo(() => {
    const d = dOf(order);
    const supervisor = order.store.supervisorUser
      ? getLocalizedText(order.store.supervisorUser.fullName, {
          lang,
          valueTranslations: d?.supervisorName ?? order.store.supervisorUser.displayI18n?.fullName,
          mode: "generic",
        })
      : null;
    const pr = order.store.primaryRegion;
    return {
      customerName: getLocalizedText(order.customerName, {
        lang,
        valueTranslations: d?.customerName,
        mode: "generic",
      }),
      area: getLocalizedText(order.area, { lang, valueTranslations: d?.area, mode: "place" }),
      pickupAddress: getLocalizedText(order.pickupAddress, {
        lang,
        valueTranslations: d?.pickupAddress,
        mode: "address",
      }),
      dropoffAddress: getLocalizedText(order.dropoffAddress, {
        lang,
        valueTranslations: d?.dropoffAddress,
        mode: "address",
      }),
      storeName: getLocalizedText(order.store.name, { lang, valueTranslations: d?.storeName, mode: "generic" }),
      storeArea: getLocalizedText(order.store.area, { lang, valueTranslations: d?.storeArea, mode: "place" }),
      primaryRegionName:
        pr == null
          ? null
          : getLocalizedText(pr.name, {
              lang,
              valueTranslations: d?.primaryRegionName,
              mode: "place",
            }),
      supervisorName: supervisor,
      notes:
        order.notes == null || !String(order.notes).trim()
          ? null
          : getLocalizedText(order.notes, { lang, valueTranslations: d?.notes, mode: "address" }),
    };
  }, [order, lang]);
}
