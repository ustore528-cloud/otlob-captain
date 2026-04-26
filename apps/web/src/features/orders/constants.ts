import type { OrderStatus } from "@/types/api";

/** Order status filter values — labels come from i18n `orderStatus.*` and `orders.list.statusAll`. */
export const ORDER_STATUS_FILTER_VALUES: Array<OrderStatus | ""> = [
  "",
  "PENDING",
  "CONFIRMED",
  "ASSIGNED",
  "ACCEPTED",
  "PICKED_UP",
  "IN_TRANSIT",
  "DELIVERED",
  "CANCELLED",
];
