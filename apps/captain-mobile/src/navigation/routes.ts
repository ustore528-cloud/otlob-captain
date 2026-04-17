import type { Href } from "expo-router";

/** Typed entry points — extend as you add stacks/modals. */
export const routes = {
  root: "/" as Href,
  auth: {
    login: "/(auth)/login" as Href,
  },
  app: {
    tabs: "/(app)/(tabs)" as Href,
    home: "/(app)/(tabs)" as Href,
    assignment: "/(app)/(tabs)/assignment" as Href,
    order: (orderId: string) => `/(app)/order/${orderId}` as Href,
    orders: "/(app)/(tabs)/orders" as Href,
    earnings: "/(app)/(tabs)/earnings" as Href,
    tracking: "/(app)/(tabs)/tracking" as Href,
    notifications: "/(app)/(tabs)/notifications" as Href,
    profile: "/(app)/(tabs)/profile" as Href,
  },
} as const;
