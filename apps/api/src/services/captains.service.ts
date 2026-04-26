import { Prisma, UserRole, OrderStatus, type OrderStatus as OrderStatusT } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { prisma } from "../lib/prisma.js";
import { assertOptionalCaptainSupervisorLinkValid } from "../lib/store-supervisor-validation.js";
import { hashPassword } from "../lib/password.js";
import { captainRepository, captainWithRelationsInclude } from "../repositories/captain.repository.js";
import { orderRepository } from "../repositories/order.repository.js";
import { toOrderListItemDto } from "../dto/order.dto.js";
import { userRepository } from "../repositories/user.repository.js";
import { AppError } from "../utils/errors.js";
import { activityService } from "./activity.service.js";
import {
  assertStaffCanAccessCaptain,
  resolveBranchIdForStaffOperation,
  resolveStaffTenantOrderListFilter,
} from "./tenant-scope.service.js";
import { isCaptainRole, isOrderOperatorRole, isSuperAdminRole, type AppRole } from "../lib/rbac-roles.js";

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

function assertCompanyAdminCaptainOwnership(
  actor: { userId: string; role: AppRole },
  captain: { createdByUserId?: string | null },
): void {
  if (actor.role !== "COMPANY_ADMIN") return;
  if (!captain.createdByUserId || captain.createdByUserId !== actor.userId) {
    throw new AppError(403, "Forbidden", "FORBIDDEN");
  }
}

export const captainsService = {
  async create(
    input: {
      fullName: string;
      phone: string;
      email?: string;
      password: string;
      vehicleType: string;
      area: string;
      branchId?: string;
      zoneId?: string;
      companyId?: string;
      supervisorUserId?: string | null;
    },
    actorUserId: string,
  ) {
    const passwordHash = await hashPassword(input.password);
    const actor = await userRepository.findById(actorUserId);
    if (!actor) throw new AppError(401, "User not found", "UNAUTHORIZED");
    const actorRole = actor.role as AppRole;
    let companyId: string;
    let branchId: string;
    let effectiveSupervisorUserId = input.supervisorUserId ?? null;
    if (actor.role === UserRole.BRANCH_MANAGER) {
      if (input.companyId) {
        throw new AppError(400, "companyId is only valid for SUPER_ADMIN.", "COMPANY_ID_NOT_ALLOWED");
      }
      if (!actor.companyId || !actor.branchId) {
        throw new AppError(403, "Branch manager scope is missing", "TENANT_SCOPE_REQUIRED");
      }
      if (input.branchId && input.branchId !== actor.branchId) {
        throw new AppError(403, "Cannot create captain outside your region", "FORBIDDEN");
      }
      companyId = actor.companyId;
      branchId = actor.branchId;
      // Region supervisor creates captains only under their own supervisor linkage.
      effectiveSupervisorUserId = actor.id;
    } else if (isSuperAdminRole(actorRole)) {
      if (!input.companyId?.trim()) {
        if (input.branchId || input.zoneId) {
          throw new AppError(
            400,
            "companyId is required when branchId or zoneId is provided for SUPER_ADMIN.",
            "COMPANY_ID_REQUIRED",
          );
        }
        throw new AppError(
          400,
          "companyId is required for SUPER_ADMIN when creating a captain.",
          "COMPANY_ID_REQUIRED",
        );
      }
      const targetCompanyId = input.companyId.trim();
      const companyRow = await prisma.company.findFirst({
        where: { id: targetCompanyId, isActive: true },
        select: { id: true },
      });
      if (!companyRow) {
        throw new AppError(400, "Invalid or inactive company.", "INVALID_COMPANY");
      }
      companyId = targetCompanyId;

      if (input.branchId) {
        const b = await prisma.branch.findFirst({
          where: { id: input.branchId, companyId, isActive: true },
          select: { id: true },
        });
        if (!b) {
          throw new AppError(
            400,
            "branchId does not belong to the selected company (or branch is inactive).",
            "INVALID_BRANCH_FOR_COMPANY",
          );
        }
        branchId = b.id;
      } else {
        const branches = await prisma.branch.findMany({
          where: { companyId, isActive: true },
          select: { id: true },
          orderBy: { createdAt: "asc" },
        });
        if (branches.length === 0) {
          throw new AppError(400, "No active branch for this company.", "NO_ACTIVE_BRANCH");
        }
        if (branches.length > 1) {
          throw new AppError(
            400,
            "branchId is required when the selected company has more than one active branch.",
            "BRANCH_REQUIRED",
          );
        }
        const only = branches[0];
        if (!only) {
          throw new AppError(500, "Branch resolution failed", "INTERNAL");
        }
        branchId = only.id;
      }
    } else {
      if (input.companyId) {
        throw new AppError(400, "companyId is only valid for SUPER_ADMIN.", "COMPANY_ID_NOT_ALLOWED");
      }
      const resolved = await resolveBranchIdForStaffOperation(actorUserId, input.branchId);
      companyId = resolved.companyId;
      branchId = resolved.branchId;
    }
    const supervisorForAssert = effectiveSupervisorUserId
      ? await userRepository.findById(effectiveSupervisorUserId)
      : null;
    if (effectiveSupervisorUserId && !supervisorForAssert) {
      throw new AppError(400, "Supervisor user not found", "VALIDATION_ERROR");
    }
    assertOptionalCaptainSupervisorLinkValid({
      supervisorUser: supervisorForAssert,
      captainCompanyId: companyId,
      captainBranchId: branchId,
    });
    let zoneConnect: { connect: { id: string } } | undefined;
    if (input.zoneId) {
      const z = await prisma.zone.findFirst({
        where: { id: input.zoneId, isActive: true, city: { companyId } },
        select: { id: true },
      });
      if (!z) throw new AppError(400, "Invalid zone for this company.", "INVALID_ZONE");
      zoneConnect = { connect: { id: z.id } };
    }
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
            user: { connect: { id: user.id } },
            company: { connect: { id: companyId } },
            branch: { connect: { id: branchId } },
            createdByUser: { connect: { id: actorUserId } },
            vehicleType: input.vehicleType,
            area: input.area,
            isActive: true,
            ...(effectiveSupervisorUserId
              ? { supervisorUser: { connect: { id: effectiveSupervisorUserId } } }
              : {}),
            ...(zoneConnect ? { zone: zoneConnect } : {}),
          },
          include: captainWithRelationsInclude,
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
      prepaidEnabled: boolean;
      commissionPercent: number | null;
      minimumBalanceToReceiveOrders: number | null;
      supervisorUserId: string | null;
    }>,
    actorUserId: string,
    opts: { role: AppRole; userId: string; companyId: string | null; branchId: string | null },
  ) {
    const cap = await captainRepository.findById(id);
    if (!cap) throw new AppError(404, "Captain not found", "NOT_FOUND");
    if (isOrderOperatorRole(opts.role)) {
      await assertStaffCanAccessCaptain(
        {
          userId: opts.userId,
          role: opts.role,
          companyId: opts.companyId ?? null,
          branchId: opts.branchId ?? null,
        },
        cap,
      );
      assertCompanyAdminCaptainOwnership(
        { userId: opts.userId, role: opts.role },
        { createdByUserId: cap.createdByUserId ?? null },
      );
    }
    if (isCaptainRole(opts.role) && cap.userId !== opts.userId) {
      throw new AppError(403, "Forbidden", "FORBIDDEN");
    }
    if (isCaptainRole(opts.role) && input.isActive !== undefined) {
      throw new AppError(403, "Cannot change activation", "FORBIDDEN");
    }
    if (isCaptainRole(opts.role) && (input.fullName !== undefined || input.phone !== undefined)) {
      throw new AppError(403, "Cannot change account name or phone", "FORBIDDEN");
    }
    if (isCaptainRole(opts.role) && input.supervisorUserId !== undefined) {
      throw new AppError(403, "Cannot change supervisor link", "FORBIDDEN");
    }
    if (opts.role === UserRole.BRANCH_MANAGER && input.supervisorUserId !== undefined) {
      if (input.supervisorUserId !== null && input.supervisorUserId !== opts.userId) {
        throw new AppError(403, "Branch manager can only link captains to self", "FORBIDDEN");
      }
    }

    const data: Prisma.CaptainUpdateInput = {};
    if (input.vehicleType !== undefined) data.vehicleType = input.vehicleType;
    if (input.area !== undefined) data.area = input.area;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (isOrderOperatorRole(opts.role) && input.prepaidEnabled !== undefined) {
      data.prepaidEnabled = input.prepaidEnabled;
    }
    if (isOrderOperatorRole(opts.role) && input.commissionPercent !== undefined) {
      data.commissionPercent = input.commissionPercent == null ? null : new Prisma.Decimal(input.commissionPercent);
    }
    if (isOrderOperatorRole(opts.role) && input.minimumBalanceToReceiveOrders !== undefined) {
      data.minimumBalanceToReceiveOrders =
        input.minimumBalanceToReceiveOrders == null ? null : new Prisma.Decimal(input.minimumBalanceToReceiveOrders);
    }
    if (isOrderOperatorRole(opts.role) && input.supervisorUserId !== undefined) {
      const supervisorForAssert = input.supervisorUserId
        ? await userRepository.findById(input.supervisorUserId)
        : null;
      if (input.supervisorUserId && !supervisorForAssert) {
        throw new AppError(400, "Supervisor user not found", "VALIDATION_ERROR");
      }
      assertOptionalCaptainSupervisorLinkValid({
        supervisorUser: supervisorForAssert,
        captainCompanyId: cap.companyId,
        captainBranchId: cap.branchId,
      });
      if (input.supervisorUserId === null) {
        data.supervisorUser = { disconnect: true };
      } else {
        data.supervisorUser = { connect: { id: input.supervisorUserId } };
      }
    }

    const relationsInclude = captainWithRelationsInclude;

    try {
      const updated = await prisma.$transaction(async (tx) => {
        if (isOrderOperatorRole(opts.role)) {
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
            include: relationsInclude,
          });
        }
        return tx.captain.findUniqueOrThrow({
          where: { id },
          include: relationsInclude,
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

  async list(
    params: Parameters<typeof captainRepository.list>[0],
    opts?: { userId: string; role: AppRole; companyId: string | null; branchId: string | null },
  ) {
    if (opts && isOrderOperatorRole(opts.role)) {
      const tenant = await resolveStaffTenantOrderListFilter({
        userId: opts.userId,
        role: opts.role,
        companyId: opts.companyId ?? null,
        branchId: opts.branchId ?? null,
      });
      const [total, items] = await captainRepository.list({
        ...params,
        companyId: tenant.companyId,
        branchId: tenant.branchId,
        ...(opts.role === "COMPANY_ADMIN" ? { createdByUserId: opts.userId } : {}),
      });
      return { total, items };
    }
    const [total, items] = await captainRepository.list(params);
    return { total, items };
  },

  async getById(
    id: string,
    actor?: { userId: string; role: AppRole; companyId: string | null; branchId: string | null },
  ) {
    const cap = await captainRepository.findById(id);
    if (!cap) throw new AppError(404, "Captain not found", "NOT_FOUND");
    if (actor && isOrderOperatorRole(actor.role)) {
      await assertStaffCanAccessCaptain(
        {
          userId: actor.userId,
          role: actor.role,
          companyId: actor.companyId ?? null,
          branchId: actor.branchId ?? null,
        },
        cap,
      );
      assertCompanyAdminCaptainOwnership(
        { userId: actor.userId, role: actor.role },
        { createdByUserId: cap.createdByUserId ?? null },
      );
    }
    return cap;
  },

  async setActive(
    id: string,
    isActive: boolean,
    actorUserId: string,
    actorScope?: { userId: string; role: AppRole; companyId: string | null; branchId: string | null },
  ) {
    if (actorScope && isOrderOperatorRole(actorScope.role)) {
      await this.getById(id, actorScope);
    }
    const updated = await captainRepository.update(id, { isActive });
    await activityService.log(actorUserId, isActive ? "CAPTAIN_ACTIVATED" : "CAPTAIN_DEACTIVATED", "captain", id, {});
    return updated;
  },

  async setAvailability(
    captainId: string,
    userId: string,
    availabilityStatus: import("@prisma/client").CaptainAvailabilityStatus,
    actorUserId: string,
    opts: { role: AppRole },
  ) {
    const cap = await captainRepository.findById(captainId);
    if (!cap) throw new AppError(404, "Captain not found", "NOT_FOUND");
    if (isCaptainRole(opts.role) && cap.userId !== userId) {
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
    actor: { userId: string; role: AppRole; companyId: string | null; branchId: string | null },
  ) {
    const cap = await this.getById(captainId, actor);

    const from = parseOptionalIsoDate("from", params.from, false);
    const to = parseOptionalIsoDate("to", params.to, true);

    const [total, items] = await orderRepository.listForCaptain({
      captainId,
      branchId: cap.branchId,
      status: params.status,
      from,
      to,
      area: params.area,
      q: params.q,
      page: params.page,
      pageSize: params.pageSize,
    });
    return { total, items: items.map((o) => toOrderListItemDto(o)) };
  },

  async deleteCaptain(
    captainId: string,
    actorUserId: string,
    actorScope: { userId: string; role: AppRole; companyId: string | null; branchId: string | null },
  ) {
    await this.getById(captainId, actorScope);

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
      const cap = await tx.captain.findUnique({ where: { id: captainId } });
      if (!cap) throw new AppError(404, "Captain not found", "NOT_FOUND");
      await tx.captain.delete({ where: { id: captainId } });
      await tx.user.delete({ where: { id: cap.userId } });
    });

    await activityService.log(actorUserId, "CAPTAIN_DELETED", "captain", captainId, {});
    return { deleted: true as const };
  },

  async stats(
    captainId: string,
    actor?: { userId: string; role: AppRole; companyId: string | null; branchId: string | null },
  ) {
    await this.getById(captainId, actor);

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
