import type { Server } from "socket.io";

let io: Server | null = null;

export function setIo(server: Server): void {
  io = server;
}

export function getIo(): Server | null {
  return io;
}

export const rooms = {
  dispatchers: "dispatchers",
  store: (id: string) => `store:${id}`,
  captain: (id: string) => `captain:${id}`,
} as const;

export function emitOrderUpdated(payload: unknown): void {
  io?.to(rooms.dispatchers).emit("order:updated", payload);
}

export function emitOrderCreated(payload: unknown): void {
  io?.to(rooms.dispatchers).emit("order:created", payload);
}

export function emitCaptainLocation(payload: unknown): void {
  io?.to(rooms.dispatchers).emit("captain:location", payload);
}

export function emitToCaptain(captainUserId: string, event: string, payload: unknown): void {
  io?.to(rooms.captain(captainUserId)).emit(event, payload);
}
