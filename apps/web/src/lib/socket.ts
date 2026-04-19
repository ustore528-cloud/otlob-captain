import { io, type Socket } from "socket.io-client";
import { apiBaseUrl } from "@/lib/api/http";

export function createDashboardSocket(token: string): Socket {
  return io(apiBaseUrl || window.location.origin, {
    path: "/socket.io",
    transports: ["websocket"],
    auth: { token },
  });
}
