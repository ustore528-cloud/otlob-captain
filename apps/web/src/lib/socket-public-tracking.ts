import { io, type Socket } from "socket.io-client";
import { apiBaseUrl } from "@/lib/api/http";

export type PublicOrderPageSocketAuth = {
  client: "public_order_page";
};

/** Anonymous `/request` page — joins `customer_order:<token>` only after `customer:join_order`. */
export function createPublicOrderPageSocket(): Socket {
  const auth: PublicOrderPageSocketAuth = { client: "public_order_page" };
  return io(apiBaseUrl || window.location.origin, {
    path: "/socket.io",
    transports: ["websocket", "polling"],
    upgrade: true,
    auth,
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 12,
    reconnectionDelay: 750,
    reconnectionDelayMax: 8000,
  });
}
