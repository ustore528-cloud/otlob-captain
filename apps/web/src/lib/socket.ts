import { io, type Socket } from "socket.io-client";

const BASE = import.meta.env.VITE_API_URL ?? "";

export function createDashboardSocket(token: string): Socket {
  return io(BASE || window.location.origin, {
    path: "/socket.io",
    transports: ["websocket"],
    auth: { token },
  });
}
