import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import type { UserRole } from "@prisma/client";
import { resolveCorsOrigin } from "../config/cors-options.js";
import { verifyAccessToken } from "../lib/jwt.js";
import { prisma } from "../lib/prisma.js";
import { isCaptainRole, isDispatcherRole, isManagementAdminRole, isStoreAdminRole, isSuperAdminRole } from "../lib/rbac-roles.js";
import { customerSocketRoomForTrackingToken } from "./customer-order-public-tracking.js";
import { setIo, rooms } from "./hub.js";
import type { AppRole } from "../lib/rbac-roles.js";

export type RealtimeTenantActor = {
  userId: string;
  role: AppRole;
  storeId: string | null;
  companyId: string | null;
  branchId: string | null;
};

export function requiresCompanyScopeForRealtime(role: AppRole): boolean {
  return (
    role === "COMPANY_ADMIN" ||
    role === "DISPATCHER" ||
    role === "CAPTAIN" ||
    role === "BRANCH_MANAGER" ||
    role === "CAPTAIN_SUPERVISOR" ||
    role === "STORE_ADMIN" ||
    role === "STORE_USER" ||
    role === "STORE"
  );
}

export function canActorJoinCompanyRoom(
  actor: Pick<RealtimeTenantActor, "role" | "companyId">,
  requestedCompanyId: string,
): { allowed: boolean; code?: "TENANT_SCOPE_REQUIRED" | "FORBIDDEN" } {
  if (isSuperAdminRole(actor.role)) return { allowed: true };
  if (!actor.companyId) return { allowed: false, code: "TENANT_SCOPE_REQUIRED" };
  if (actor.companyId !== requestedCompanyId) return { allowed: false, code: "FORBIDDEN" };
  return { allowed: true };
}

export function resolveSocketJoinRooms(actor: RealtimeTenantActor): string[] {
  const toJoin: string[] = [];
  if (isSuperAdminRole(actor.role)) {
    toJoin.push(rooms.operationsGlobal());
    if (actor.companyId) {
      toJoin.push(rooms.operationsCompany(actor.companyId));
    }
  }
  if ((isManagementAdminRole(actor.role) || isDispatcherRole(actor.role)) && actor.companyId) {
    toJoin.push(
      actor.branchId ? rooms.dispatchersBranch(actor.companyId, actor.branchId) : rooms.dispatchersCompany(actor.companyId),
    );
  }
  if (actor.storeId && isStoreAdminRole(actor.role)) {
    toJoin.push(rooms.store(actor.storeId));
  }
  if (isCaptainRole(actor.role)) {
    toJoin.push(rooms.captain(actor.userId));
    if (actor.companyId) {
      toJoin.push(rooms.operationsCompany(actor.companyId));
    }
  }
  return toJoin;
}

async function resolveRealtimeActor(payload: ReturnType<typeof verifyAccessToken>): Promise<RealtimeTenantActor> {
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, role: true, isActive: true, companyId: true, branchId: true, captain: { select: { companyId: true } } },
  });
  if (!user || !user.isActive) throw new Error("UNAUTHORIZED");
  if (user.role !== payload.role) throw new Error("UNAUTHORIZED");

  let companyId = payload.companyId ?? user.companyId ?? null;
  let branchId = payload.branchId ?? user.branchId ?? null;
  if (isCaptainRole(payload.role)) {
    companyId = companyId ?? user.captain?.companyId ?? null;
  }
  if (requiresCompanyScopeForRealtime(payload.role) && !companyId) {
    throw new Error("TENANT_SCOPE_REQUIRED");
  }

  return {
    userId: payload.sub,
    role: payload.role,
    storeId: payload.storeId,
    companyId,
    branchId,
  };
}

export function attachSocketIo(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: resolveCorsOrigin(),
      credentials: true,
    },
  });

  io.use((socket, next) => {
    void (async () => {
      const auth = socket.handshake.auth ?? {};
      if (
        typeof auth === "object" &&
        auth !== null &&
        (auth as { client?: unknown }).client === "public_order_page"
      ) {
        socket.data.socketKind = "public_order_page" as const;
        socket.data.publicCustomerToken = undefined as string | undefined;
        return next();
      }

      const token =
        (socket.handshake.auth?.token as string | undefined) ??
        (typeof socket.handshake.query.token === "string" ? socket.handshake.query.token : undefined);
      if (!token) return next(new Error("Unauthorized"));
      const payload = verifyAccessToken(token);
      const actor = await resolveRealtimeActor(payload);
      socket.data.socketKind = "staff" as const;
      socket.data.userId = actor.userId;
      socket.data.role = actor.role as UserRole;
      socket.data.storeId = actor.storeId;
      socket.data.companyId = actor.companyId;
      socket.data.branchId = actor.branchId;
      return next();
    })().catch((error) => {
      const message = error instanceof Error && error.message === "TENANT_SCOPE_REQUIRED" ? "TENANT_SCOPE_REQUIRED" : "Unauthorized";
      return next(new Error(message));
    });
  });

  io.on("connection", (socket) => {
    if (socket.data.socketKind === "public_order_page") {
      socket.on("customer:join_order", async (raw: unknown) => {
        if (socket.disconnected || socket.data.socketKind !== "public_order_page") return;

        let tokenRaw: unknown;
        if (typeof raw === "object" && raw !== null && "trackingToken" in raw) {
          tokenRaw = (raw as { trackingToken: unknown }).trackingToken;
        } else {
          tokenRaw = raw;
        }
        const trackingToken =
          typeof tokenRaw === "string"
            ? tokenRaw.trim()
            : typeof raw === "string"
              ? raw.trim()
              : "";
        const maxLen = 64;
        if (!trackingToken || trackingToken.length > maxLen) {
          socket.emit("customer:join_order:error", { code: "INVALID_TOKEN" });
          return;
        }

        const row = await prisma.order.findUnique({
          where: { publicTrackingToken: trackingToken },
          select: { publicTrackingToken: true },
        });
        const stored = row?.publicTrackingToken ?? null;
        if (!stored || stored !== trackingToken) {
          socket.emit("customer:join_order:error", { code: "INVALID_TOKEN" });
          return;
        }

        const prev = socket.data.publicCustomerToken as string | undefined;
        if (prev && prev !== trackingToken) {
          await socket.leave(customerSocketRoomForTrackingToken(prev));
        }
        const room = customerSocketRoomForTrackingToken(trackingToken);
        await socket.join(room);
        socket.data.publicCustomerToken = trackingToken;
        socket.emit("customer:join_order:ok", { ok: true });
      });

      return;
    }

    const actor: RealtimeTenantActor = {
      userId: socket.data.userId as string,
      role: socket.data.role as AppRole,
      storeId: socket.data.storeId as string | null,
      companyId: socket.data.companyId as string | null,
      branchId: socket.data.branchId as string | null,
    };
    for (const room of resolveSocketJoinRooms(actor)) {
      void socket.join(room);
    }

    socket.on("tenant:join-company-room", (requestedCompanyId: unknown) => {
      if (typeof requestedCompanyId !== "string" || requestedCompanyId.length === 0) return;
      const verdict = canActorJoinCompanyRoom(actor, requestedCompanyId);
      if (!verdict.allowed) {
        socket.emit("tenant:join-company-room:denied", { code: verdict.code ?? "FORBIDDEN" });
        return;
      }
      void socket.join(rooms.operationsCompany(requestedCompanyId));
      socket.emit("tenant:join-company-room:ok", { ok: true });
    });
  });

  setIo(io);
  return io;
}
