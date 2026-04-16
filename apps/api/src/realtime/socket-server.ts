import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import type { UserRole } from "@prisma/client";
import { resolveCorsOrigin } from "../config/cors-options.js";
import { verifyAccessToken } from "../lib/jwt.js";
import { setIo, rooms } from "./hub.js";

export function attachSocketIo(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: resolveCorsOrigin(),
      credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ??
        (typeof socket.handshake.query.token === "string" ? socket.handshake.query.token : undefined);
      if (!token) return next(new Error("Unauthorized"));
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      socket.data.role = payload.role as UserRole;
      socket.data.storeId = payload.storeId;
      return next();
    } catch {
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const role = socket.data.role as UserRole;
    const userId = socket.data.userId as string;
    const storeId = socket.data.storeId as string | null;

    if (role === "ADMIN" || role === "DISPATCHER") {
      void socket.join(rooms.dispatchers);
    }
    if (storeId && role === "STORE") {
      void socket.join(rooms.store(storeId));
    }
    if (role === "CAPTAIN") {
      void socket.join(rooms.captain(userId));
    }
  });

  setIo(io);
  return io;
}
