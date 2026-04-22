import { io, type Socket } from "socket.io-client";
import { apiBaseUrl } from "@/lib/api/http";

export function createDashboardSocket(token: string): Socket {
  return io(apiBaseUrl || window.location.origin, {
    path: "/socket.io",
    transports: ["websocket", "polling"],
    upgrade: true,
    auth: { token },
    reconnection: true,
    reconnectionAttempts: 8,
    reconnectionDelay: 800,
  });
}
