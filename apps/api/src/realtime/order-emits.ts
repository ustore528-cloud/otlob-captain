import type { OrderStatus } from "@prisma/client";
import { CAPTAIN_SOCKET_EVENTS } from "./captain-events.js";
import { emitOrderDispatchersOnly, emitOrderUpdated, emitToCaptain } from "./hub.js";

type OrderEmitCore = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  companyId: string;
  branchId: string;
};

export function emitDispatcherOrderUpdated(order: OrderEmitCore, previousStatus?: OrderStatus | null): void {
  emitOrderUpdated(
    {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      ...(previousStatus !== undefined && previousStatus !== null ? { previousStatus } : {}),
    },
    {
      companyId: order.companyId,
      branchId: order.branchId,
    },
  );
}

/** Dispatcher dashboard refresh without public customer sockets or web push */
export function emitDispatchersOnlyOrderFresh(order: OrderEmitCore): void {
  emitOrderDispatchersOnly(
    { id: order.id, orderNumber: order.orderNumber, status: order.status },
    { companyId: order.companyId, branchId: order.branchId },
  );
}

export function emitCaptainOrderUpdated(captainUserId: string, order: OrderEmitCore): void {
  emitToCaptain(captainUserId, CAPTAIN_SOCKET_EVENTS.ORDER_UPDATED, {
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
  });
}

export function emitCaptainAssignmentEnded(captainUserId: string, payload: { orderId: string; reason: string }): void {
  emitToCaptain(captainUserId, CAPTAIN_SOCKET_EVENTS.ASSIGNMENT_ENDED, payload);
}
