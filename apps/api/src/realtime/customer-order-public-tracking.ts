import type { OrderStatus } from "@prisma/client";

/** Stable i18n resource keys consumed by `/request` Web (Arabic / English / Hebrew). */
export const CUSTOMER_ORDER_PUBLIC_KEYS: Record<
  OrderStatus,
  { statusLabelKey: string; messageKey: string }
> = {
  PENDING: {
    statusLabelKey: "public.customerOrder.socket.statusLabel.orderReceived",
    messageKey: "public.customerOrder.socket.message.orderReceived",
  },
  CONFIRMED: {
    statusLabelKey: "public.customerOrder.socket.statusLabel.orderAccepted",
    messageKey: "public.customerOrder.socket.message.orderAccepted",
  },
  ASSIGNED: {
    statusLabelKey: "public.customerOrder.socket.statusLabel.captainAssigned",
    messageKey: "public.customerOrder.socket.message.captainAssigned",
  },
  ACCEPTED: {
    statusLabelKey: "public.customerOrder.socket.statusLabel.captainEnRoutePickup",
    messageKey: "public.customerOrder.socket.message.captainEnRoutePickup",
  },
  PICKED_UP: {
    statusLabelKey: "public.customerOrder.socket.statusLabel.pickedUp",
    messageKey: "public.customerOrder.socket.message.pickedUp",
  },
  IN_TRANSIT: {
    statusLabelKey: "public.customerOrder.socket.statusLabel.enRouteToCustomer",
    messageKey: "public.customerOrder.socket.message.enRouteToCustomer",
  },
  DELIVERED: {
    statusLabelKey: "public.customerOrder.socket.statusLabel.delivered",
    messageKey: "public.customerOrder.socket.message.delivered",
  },
  CANCELLED: {
    statusLabelKey: "public.customerOrder.socket.statusLabel.canceled",
    messageKey: "public.customerOrder.socket.message.canceled",
  },
};

export function customerSocketRoomForTrackingToken(trackingToken: string): string {
  return `customer_order:${trackingToken}`;
}
