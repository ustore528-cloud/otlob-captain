import { io, type Socket } from "socket.io-client";
import { env } from "@/utils/env";

let socket: Socket | null = null;

/**
 * Singleton Socket.IO client — call `connectCaptainSocket` after login with access token.
 * @see docs/mobile-captain-api.md §7
 */
export function getCaptainSocket(): Socket | null {
  return socket;
}

export function connectCaptainSocket(accessToken: string): Socket {
  disconnectCaptainSocket();
  socket = io(env.apiUrl, {
    transports: ["websocket"],
    auth: { token: accessToken },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 800,
    reconnectionDelayMax: 12_000,
    timeout: 20_000,
  });
  return socket;
}

export function disconnectCaptainSocket(): void {
  if (socket) {
    socket.disconnect();
    socket.removeAllListeners();
    socket = null;
  }
}
