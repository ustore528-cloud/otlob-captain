import type { OrderStatus } from "@prisma/client";
import type { Server } from "socket.io";
import { prisma } from "../lib/prisma.js";
import {
  CUSTOMER_ORDER_PUBLIC_KEYS,
  customerSocketRoomForTrackingToken,
} from "./customer-order-public-tracking.js";
import { notifyPublicCustomerOrderTrackingWebPush } from "../services/customer-public-order-web-push.service.js";

let io: Server | null = null;

export function setIo(server: Server): void {
  io = server;
}

export function getIo(): Server | null {
  return io;
}

export const rooms = {
  operationsGlobal: () => "ops:global",
  operationsCompany: (companyId: string) => `ops:company:${companyId}`,
  dispatchersCompany: (companyId: string) => `dispatchers:company:${companyId}`,
  dispatchersBranch: (companyId: string, branchId: string) => `dispatchers:company:${companyId}:branch:${branchId}`,
  store: (id: string) => `store:${id}`,
  captain: (id: string) => `captain:${id}`,
} as const;

type DispatcherTenantScope = {
  companyId: string;
  branchId?: string | null;
};

function emitToDispatchers(event: string, payload: unknown, scope: DispatcherTenantScope): void {
  io?.to(rooms.dispatchersCompany(scope.companyId)).emit(event, payload);
  if (scope.branchId) {
    io?.to(rooms.dispatchersBranch(scope.companyId, scope.branchId)).emit(event, payload);
  }
}

const CUSTOMER_SOCKET_EVENT = "customer:order_status_changed" as const;

function schedulePublicCustomerOrderTrackingEmit(
  orderId: string,
  status: OrderStatus,
  loggedPrevious: string | null,
): void {
  void (async () => {
    try {
      const row = await prisma.order.findUnique({
        where: { id: orderId },
        select: { publicTrackingToken: true },
      });
      const trackingToken = row?.publicTrackingToken?.trim();
      if (!trackingToken) return;

      const keys = CUSTOMER_ORDER_PUBLIC_KEYS[status] ?? CUSTOMER_ORDER_PUBLIC_KEYS.PENDING;
      const emittedAt = new Date().toISOString();
      const room = customerSocketRoomForTrackingToken(trackingToken);
      const body = {
        trackingToken,
        status,
        statusLabelKey: keys.statusLabelKey,
        messageKey: keys.messageKey,
        updatedAt: emittedAt,
      };

      io?.to(room).emit(CUSTOMER_SOCKET_EVENT, body);

      console.info("[customer-public-order:socket]", {
        orderId,
        oldStatus: loggedPrevious ?? "UNKNOWN",
        newStatus: status,
        trackingToken,
        emittedRoom: room,
        emittedAt,
      });

      await notifyPublicCustomerOrderTrackingWebPush(orderId, status);
    } catch {
      /* ignore realtime side-channel failures */
    }
  })();
}

function emitPublicCustomerTrackingChannels(payload: unknown): void {
  if (typeof payload !== "object" || payload === null) return;
  const rec = payload as Record<string, unknown>;
  const orderId = typeof rec.id === "string" ? rec.id : null;
  const statusRaw = typeof rec.status === "string" ? rec.status : null;
  if (!orderId || !statusRaw) return;

  const previousStatusRaw = rec.previousStatus;
  const loggedPrevious =
    typeof previousStatusRaw === "string" && previousStatusRaw.length > 0 ? previousStatusRaw : null;

  schedulePublicCustomerOrderTrackingEmit(orderId, statusRaw as OrderStatus, loggedPrevious);
}

/**
 * In-room `customer:order_status_changed` + optional Web Push — no dispatcher `order:updated`, no captain.
 * Use after public order create when `publicTrackingToken` is set (initial PENDING / ORDER_CREATED parity).
 */
export function emitPublicCustomerTrackingOnly(orderId: string, status: OrderStatus): void {
  schedulePublicCustomerOrderTrackingEmit(orderId, status, null);
}

/** Skip in-page customer pushes when callers supply `previousStatus` and it equals the new status (dispatcher still refreshes). */
function shouldEmitPublicCustomerOrderSocket(payload: unknown): boolean {
  if (typeof payload !== "object" || payload === null) return false;
  const rec = payload as Record<string, unknown>;
  const status = typeof rec.status === "string" ? rec.status : null;
  if (!status) return false;
  const previousStatusRaw = rec.previousStatus;
  const previousStatus =
    typeof previousStatusRaw === "string" && previousStatusRaw.length > 0 ? previousStatusRaw : null;
  if (previousStatus !== null && previousStatus === status) {
    return false;
  }
  return true;
}

export function emitOrderDispatchersOnly(payload: unknown, scope: DispatcherTenantScope): void {
  emitToDispatchers("order:updated", payload, scope);
}

export function emitOrderUpdated(payload: unknown, scope: DispatcherTenantScope): void {
  emitToDispatchers("order:updated", payload, scope);
  if (shouldEmitPublicCustomerOrderSocket(payload)) {
    emitPublicCustomerTrackingChannels(payload);
  }
}

export function emitOrderCreated(payload: unknown, scope: DispatcherTenantScope): void {
  emitToDispatchers("order:created", payload, scope);
}

export function emitCaptainLocation(payload: unknown, scope: DispatcherTenantScope): void {
  // eslint-disable-next-line no-console
  console.info("[socket-location] emitted", {
    events: ["captain:location", "captain:location:update"],
    companyId: scope.companyId,
    branchId: scope.branchId ?? null,
  });
  emitToDispatchers("captain:location", payload, scope);
  emitToDispatchers("captain:location:update", payload, scope);
}

export function emitOperationalGlobal(event: string, payload: unknown, options: { explicitGlobal: true }): void {
  if (!options.explicitGlobal) return;
  io?.to(rooms.operationsGlobal()).emit(event, payload);
}

export function emitToCaptain(captainUserId: string, event: string, payload: unknown): void {
  io?.to(rooms.captain(captainUserId)).emit(event, payload);
}
