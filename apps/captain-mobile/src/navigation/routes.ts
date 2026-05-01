import type { Href } from "expo-router";

/** Typed entry points — extend as you add stacks/modals. */
export const routes = {
  root: "/" as Href,
  auth: {
    login: "/(auth)/login" as Href,
  },
  guest: {
    home: "/(guest)/home" as Href,
  },
  app: {
    /** المسار الافتراضي بعد تسجيل الدخول — تبويب الطلبات المتاحة */
    tabs: "/(app)/(tabs)/orders" as Href,
    home: "/(app)/(tabs)/home" as Href,
    settings: "/(app)/(tabs)/settings" as Href,
    assignment: "/(app)/(tabs)/assignment" as Href,
    order: (orderId: string) => `/(app)/order/${orderId}` as Href,
    orders: "/(app)/(tabs)/orders" as Href,
    earnings: "/(app)/(tabs)/earnings" as Href,
    tracking: "/(app)/(tabs)/tracking" as Href,
    notifications: "/(app)/(tabs)/notifications" as Href,
    profile: "/(app)/(tabs)/profile" as Href,
    accountDelete: "/(app)/account-delete" as Href,
  },
} as const;
