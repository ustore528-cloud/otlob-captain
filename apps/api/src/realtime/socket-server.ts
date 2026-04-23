import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import type { UserRole } from "@prisma/client";
import { resolveCorsOrigin } from "../config/cors-options.js";
import { verifyAccessToken } from "../lib/jwt.js";
import { prisma } from "../lib/prisma.js";
import { isDispatcherRole, isManagementAdminRole, isStoreAdminRole } from "../lib/rbac-roles.js";
import { setIo, rooms } from "./hub.js";

export function attachSocketIo(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: resolveCorsOrigin(),
      credentials: true,
    },
  });

  io.use((socket, next) => {
    void (async () => {
      const token =
        (socket.handshake.auth?.token as string | undefined) ??
        (typeof socket.handshake.query.token === "string" ? socket.handshake.query.token : undefined);
      if (!token) return next(new Error("Unauthorized"));
      const payload = verifyAccessToken(token);

      let companyId = payload.companyId;
      let branchId = payload.branchId;
      if ((isManagementAdminRole(payload.role) || isDispatcherRole(payload.role)) && !companyId) {
        const user = await prisma.user.findUnique({
          where: { id: payload.sub },
          select: { companyId: true, branchId: true },
        });
        companyId = user?.companyId ?? null;
        branchId = user?.branchId ?? null;
      }

      socket.data.userId = payload.sub;
      socket.data.role = payload.role as UserRole;
      socket.data.storeId = payload.storeId;
      socket.data.companyId = companyId;
      socket.data.branchId = branchId;
      return next();
    })().catch(() => next(new Error("Unauthorized")));
  });

  io.on("connection", (socket) => {
    const role = socket.data.role as UserRole;
    const userId = socket.data.userId as string;
    const storeId = socket.data.storeId as string | null;
    const companyId = socket.data.companyId as string | null;
    const branchId = socket.data.branchId as string | null;

    if ((isManagementAdminRole(role) || isDispatcherRole(role)) && companyId) {
      void socket.join(
        branchId ? rooms.dispatchersBranch(companyId, branchId) : rooms.dispatchersCompany(companyId),
      );
    }
    if (storeId && isStoreAdminRole(role)) {
      void socket.join(rooms.store(storeId));
    }
    if (role === "CAPTAIN") {
      void socket.join(rooms.captain(userId));
    }
  });

  setIo(io);
  return io;
}
