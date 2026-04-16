import { UserRole, OrderStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { hashPassword } from "../lib/password.js";
import { captainRepository } from "../repositories/captain.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { AppError } from "../utils/errors.js";
import { activityService } from "./activity.service.js";

export const captainsService = {
  async create(
    input: { fullName: string; phone: string; email?: string; password: string; vehicleType: string; area: string },
    actorUserId: string,
  ) {
    const passwordHash = await hashPassword(input.password);
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          fullName: input.fullName,
          phone: input.phone,
          email: input.email,
          passwordHash,
          role: UserRole.CAPTAIN,
          isActive: true,
        },
      });
      const captain = await tx.captain.create({
        data: {
          userId: user.id,
          vehicleType: input.vehicleType,
          area: input.area,
          isActive: true,
        },
        include: { user: { select: { id: true, fullName: true, phone: true, email: true } } },
      });
      return captain;
    });
    await activityService.log(actorUserId, "CAPTAIN_CREATED", "captain", result.id, {});
    return result;
  },

  async update(
    id: string,
    input: Partial<{ vehicleType: string; area: string; isActive: boolean }>,
    actorUserId: string,
    opts: { role: string; userId: string },
  ) {
    const cap = await captainRepository.findById(id);
    if (!cap) throw new AppError(404, "Captain not found", "NOT_FOUND");
    if (opts.role === "CAPTAIN" && cap.userId !== opts.userId) {
      throw new AppError(403, "Forbidden", "FORBIDDEN");
    }
    if (opts.role === "CAPTAIN" && input.isActive !== undefined) {
      throw new AppError(403, "Cannot change activation", "FORBIDDEN");
    }

    const data: Record<string, unknown> = {};
    if (input.vehicleType !== undefined) data.vehicleType = input.vehicleType;
    if (input.area !== undefined) data.area = input.area;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    const updated = await captainRepository.update(id, data);
    await activityService.log(actorUserId, "CAPTAIN_UPDATED", "captain", id, {});
    return updated;
  },

  async list(params: Parameters<typeof captainRepository.list>[0]) {
    const [total, items] = await captainRepository.list(params);
    return { total, items };
  },

  async getById(id: string) {
    const cap = await captainRepository.findById(id);
    if (!cap) throw new AppError(404, "Captain not found", "NOT_FOUND");
    return cap;
  },

  async setActive(id: string, isActive: boolean, actorUserId: string) {
    const updated = await captainRepository.update(id, { isActive });
    await activityService.log(actorUserId, isActive ? "CAPTAIN_ACTIVATED" : "CAPTAIN_DEACTIVATED", "captain", id, {});
    return updated;
  },

  async setAvailability(
    captainId: string,
    userId: string,
    availabilityStatus: import("@prisma/client").CaptainAvailabilityStatus,
    actorUserId: string,
    opts: { role: string },
  ) {
    const cap = await captainRepository.findById(captainId);
    if (!cap) throw new AppError(404, "Captain not found", "NOT_FOUND");
    if (opts.role === "CAPTAIN" && cap.userId !== userId) {
      throw new AppError(403, "Forbidden", "FORBIDDEN");
    }
    const updated = await captainRepository.update(captainId, {
      availabilityStatus,
      lastSeenAt: new Date(),
    });
    await activityService.log(actorUserId, "CAPTAIN_AVAILABILITY", "captain", captainId, { availabilityStatus });
    return updated;
  },

  async stats(captainId: string) {
    const cap = await captainRepository.findById(captainId);
    if (!cap) throw new AppError(404, "Captain not found", "NOT_FOUND");

    const [delivered, activeOrders] = await prisma.$transaction([
      prisma.order.count({
        where: { assignedCaptainId: captainId, status: OrderStatus.DELIVERED },
      }),
      prisma.order.count({
        where: {
          assignedCaptainId: captainId,
          status: { in: [OrderStatus.ACCEPTED, OrderStatus.PICKED_UP, OrderStatus.IN_TRANSIT] },
        },
      }),
    ]);

    const lastLocation = await prisma.captainLocation.findFirst({
      where: { captainId },
      orderBy: { recordedAt: "desc" },
    });

    return {
      captainId,
      ordersDelivered: delivered,
      activeOrders,
      lastLocation,
    };
  },
};
