import type { Server } from "socket.io";

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

export function emitOrderUpdated(payload: unknown, scope: DispatcherTenantScope): void {
  emitToDispatchers("order:updated", payload, scope);
}

export function emitOrderCreated(payload: unknown, scope: DispatcherTenantScope): void {
  emitToDispatchers("order:created", payload, scope);
}

export function emitCaptainLocation(payload: unknown, scope: DispatcherTenantScope): void {
  // eslint-disable-next-line no-console
  console.info("[socket-location] emitted", {
    event: "captain:location",
    companyId: scope.companyId,
    branchId: scope.branchId ?? null,
  });
  emitToDispatchers("captain:location", payload, scope);
}

export function emitOperationalGlobal(event: string, payload: unknown, options: { explicitGlobal: true }): void {
  if (!options.explicitGlobal) return;
  io?.to(rooms.operationsGlobal()).emit(event, payload);
}

export function emitToCaptain(captainUserId: string, event: string, payload: unknown): void {
  io?.to(rooms.captain(captainUserId)).emit(event, payload);
}
