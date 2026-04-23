import type { Server } from "socket.io";

let io: Server | null = null;

export function setIo(server: Server): void {
  io = server;
}

export function getIo(): Server | null {
  return io;
}

export const rooms = {
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

export function emitOrderUpdated(payload: unknown, scope: DispatcherTenantScope): void {
  emitToDispatchers("order:updated", payload, scope);
}

export function emitOrderCreated(payload: unknown, scope: DispatcherTenantScope): void {
  emitToDispatchers("order:created", payload, scope);
}

export function emitCaptainLocation(payload: unknown, scope: DispatcherTenantScope): void {
  emitToDispatchers("captain:location", payload, scope);
}

export function emitToCaptain(captainUserId: string, event: string, payload: unknown): void {
  io?.to(rooms.captain(captainUserId)).emit(event, payload);
}
