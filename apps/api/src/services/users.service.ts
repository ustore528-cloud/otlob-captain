import type { Prisma, User, UserRole } from "@prisma/client";
import { hashPassword } from "../lib/password.js";
import { userRepository } from "../repositories/user.repository.js";
import { AppError } from "../utils/errors.js";
import { activityService } from "./activity.service.js";

function toPublicUser(user: User | Record<string, unknown>) {
  const row = { ...user } as Record<string, unknown>;
  delete row.passwordHash;
  const amt = row.customerPreferredAmount;
  const del = row.customerPreferredDelivery;
  return {
    ...row,
    customerPreferredAmount: amt != null ? String(amt) : null,
    customerPreferredDelivery: del != null ? String(del) : null,
  };
}

export const usersService = {
  async list(params: { role?: UserRole; page: number; pageSize: number }) {
    const [total, items] = await userRepository.list(params);
    return { total, items: items.map((u) => toPublicUser(u)) };
  },

  async getById(id: string) {
    const user = await userRepository.findById(id);
    if (!user) throw new AppError(404, "User not found", "NOT_FOUND");
    return toPublicUser(user);
  },

  async setActive(id: string, isActive: boolean, actorUserId: string) {
    try {
      const updated = await userRepository.updateActive(id, isActive);
      await activityService.log(actorUserId, isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED", "user", id, {});
      return toPublicUser(updated);
    } catch {
      throw new AppError(404, "User not found", "NOT_FOUND");
    }
  },

  async create(
    input: { fullName: string; phone: string; email?: string; password: string; role: UserRole },
    actorUserId: string,
  ) {
    const passwordHash = await hashPassword(input.password);
    try {
      const user = await userRepository.create({
        fullName: input.fullName,
        phone: input.phone,
        email: input.email,
        passwordHash,
        role: input.role,
        isActive: true,
      });
      await activityService.log(actorUserId, "USER_CREATED", "user", user.id, { role: user.role });
      return toPublicUser(user);
    } catch {
      throw new AppError(409, "Phone or email already in use", "CONFLICT");
    }
  },

  async updateCustomerProfile(
    id: string,
    body: {
      customerPickupAddress?: string | null;
      customerDropoffAddress?: string | null;
      customerLocationLink?: string | null;
      customerArea?: string | null;
      customerDropoffLat?: number | null;
      customerDropoffLng?: number | null;
      customerPreferredAmount?: number | null;
      customerPreferredDelivery?: number | null;
    },
  ) {
    const existing = await userRepository.findById(id);
    if (!existing) throw new AppError(404, "User not found", "NOT_FOUND");
    if (existing.role !== "CUSTOMER") {
      throw new AppError(400, "Customer profile applies only to CUSTOMER users", "INVALID_ROLE");
    }

    const data: Prisma.UserUpdateInput = {};
    if (body.customerPickupAddress !== undefined) data.customerPickupAddress = body.customerPickupAddress;
    if (body.customerDropoffAddress !== undefined) data.customerDropoffAddress = body.customerDropoffAddress;
    if (body.customerLocationLink !== undefined) data.customerLocationLink = body.customerLocationLink;
    if (body.customerArea !== undefined) data.customerArea = body.customerArea;
    if (body.customerDropoffLat !== undefined && body.customerDropoffLng !== undefined) {
      data.customerDropoffLat = body.customerDropoffLat;
      data.customerDropoffLng = body.customerDropoffLng;
    }
    if (body.customerPreferredAmount !== undefined) {
      data.customerPreferredAmount =
        body.customerPreferredAmount === null ? null : body.customerPreferredAmount;
    }
    if (body.customerPreferredDelivery !== undefined) {
      data.customerPreferredDelivery =
        body.customerPreferredDelivery === null ? null : body.customerPreferredDelivery;
    }

    try {
      const updated = await userRepository.updateCustomerProfile(id, data);
      return toPublicUser(updated);
    } catch {
      throw new AppError(404, "User not found", "NOT_FOUND");
    }
  },
};
