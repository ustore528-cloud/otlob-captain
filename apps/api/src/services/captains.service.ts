import { UserRole, OrderStatus, type OrderStatus as OrderStatusT } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { prisma } from "../lib/prisma.js";
import { hashPassword } from "../lib/password.js";
import { captainRepository } from "../repositories/captain.repository.js";
import { orderRepository } from "../repositories/order.repository.js";
import { AppError } from "../utils/errors.js";
import { activityService } from "./activity.service.js";

function parseOptionalIsoDate(label: string, raw?: string, endOfDay?: boolean): Date | undefined {
  if (!raw?.trim()) return undefined;
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return endOfDay ? new Date(`${s}T23:59:59.999Z`) : new Date(`${s}T00:00:00.000Z`);
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new AppError(400, `Invalid ${label}`, "BAD_REQUEST");
  return d;
}

export const captainsService = {
  async create(
    input: { fullName: string; phone: string; email?: string; password: string; vehicleType: string; area: string },
    actorUserId: string,
  ) {
    const passwordHash = await hashPassword(input.password);
    try {
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            fullName: input.fullName,
            phone: input.phone,
            ...(input.email ? { email: input.email } : {}),
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
          include: {
            user: { select: { id: true, fullName: true, phone: true, email: true, isActive: true } },
          },
        });
        return captain;
      });
      await activityService.log(actorUserId, "CAPTAIN_CREATED", "captain", result.id, {});
      return result;
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === "P2002") {
        throw new AppError(409, "رقم الهاتف أو البريد مستخدم مسبقاً.", "CONFLICT");
      }
      throw e;
    }
  },

  async update(
    id: string,
    input: Partial<{
      vehicleType: string;
      area: string;
      isActive: boolean;
      fullName: string;
      phone: string;
    }>,
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
    if (opts.role === "CAPTAIN" && (input.fullName !== undefined || input.phone !== undefined)) {
      throw new AppError(403, "Cannot change account name or phone", "FORBIDDEN");
    }

    const data: Record<string, unknown> = {};
    if (input.vehicleType !== undefined) data.vehicleType = input.vehicleType;
    if (input.area !== undefined) data.area = input.area;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    const userInclude = { user: { select: { id: true, fullName: true, phone: true, email: true, isActive: true } } };

    try {
      const updated = await prisma.$transaction(async (tx) => {
        if (opts.role === "ADMIN" || opts.role === "DISPATCHER") {
          if (input.fullName !== undefined || input.phone !== undefined) {
            await tx.user.update({
              where: { id: cap.userId },
              data: {
                ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
                ...(input.phone !== undefined ? { phone: input.phone } : {}),
              },
            });
          }
        }
        if (Object.keys(data).length > 0) {
          return tx.captain.update({
            where: { id },
            data,
            include: userInclude,
          });
        }
        return tx.captain.findUniqueOrThrow({
          where: { id },
          include: userInclude,
        });
      });
      await activityService.log(actorUserId, "CAPTAIN_UPDATED", "captain", id, {});
      return updated;
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === "P2002") {
        throw new AppError(409, "Phone or email already in use", "CONFLICT");
      }
      throw e;
    }
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

  async listOrders(
    captainId: string,
    params: {
      page: number;
      pageSize: number;
      from?: string;
      to?: string;
      q?: string;
      area?: string;
      status?: OrderStatusT;
    },
  ) {
    const cap = await captainRepository.findById(captainId);
    if (!cap) throw new AppError(404, "Captain not found", "NOT_FOUND");

    const from = parseOptionalIsoDate("from", params.from, false);
    const to = parseOptionalIsoDate("to", params.to, true);

    const [total, items] = await orderRepository.listForCaptain({
      captainId,
      status: params.status,
      from,
      to,
      area: params.area,
      q: params.q,
      page: params.page,
      pageSize: params.pageSize,
    });
    return { total, items };
  },

  async deleteCaptain(captainId: string, actorUserId: string) {
    const cap = await captainRepository.findById(captainId);
    if (!cap) throw new AppError(404, "Captain not found", "NOT_FOUND");

    await prisma.$transaction(async (tx) => {
      const open = await tx.order.count({
        where: {
          assignedCaptainId: captainId,
          status: { notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] },
        },
      });
      if (open > 0) {
        throw new AppError(
          409,
          "لا يمكن حذف الكابتن: يوجد طلبات غير مكتملة مرتبطة به (أكملها أو ألغها أو أعد التعيين أولاً).",
          "CONFLICT",
        );
      }

      await tx.order.updateMany({
        where: { assignedCaptainId: captainId },
        data: { assignedCaptainId: null },
      });
      await tx.orderAssignmentLog.deleteMany({ where: { captainId } });
      await tx.captainLocation.deleteMany({ where: { captainId } });
      await tx.captain.delete({ where: { id: captainId } });
      await tx.user.delete({ where: { id: cap.userId } });
    });

    await activityService.log(actorUserId, "CAPTAIN_DELETED", "captain", captainId, {});
    return { deleted: true as const };
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
