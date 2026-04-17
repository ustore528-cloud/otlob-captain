/**
 * Order lifecycle — @see docs/captain-order-lifecycle.md
 */
export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "ASSIGNED"
  | "ACCEPTED"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "CANCELLED";
