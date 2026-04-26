import i18n from "@/i18n/i18n";
import type { StoreSubscriptionType } from "@/types/api";

export function storeSubscriptionLabel(subscriptionType: StoreSubscriptionType): string {
  const key = `storeSubscription.${subscriptionType}`;
  return i18n.exists(key) ? String(i18n.t(key)) : subscriptionType;
}
