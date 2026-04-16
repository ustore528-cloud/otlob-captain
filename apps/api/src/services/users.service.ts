import type { UserRole } from "@prisma/client";
import { hashPassword } from "../lib/password.js";
import { userRepository } from "../repositories/user.repository.js";
import { AppError } from "../utils/errors.js";
import { activityService } from "./activity.service.js";

export const usersService = {
  async list(params: { role?: UserRole; page: number; pageSize: number }) {
    const [total, items] = await userRepository.list(params);
    return { total, items };
  },

  async getById(id: string) {
    const user = await userRepository.findById(id);
    if (!user) throw new AppError(404, "User not found", "NOT_FOUND");
    const { passwordHash: _, ...rest } = user;
    return rest;
  },

  async setActive(id: string, isActive: boolean, actorUserId: string) {
    try {
      const updated = await userRepository.updateActive(id, isActive);
      await activityService.log(actorUserId, isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED", "user", id, {});
      return updated;
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
      const { passwordHash: __, ...rest } = user;
      return rest;
    } catch {
      throw new AppError(409, "Phone or email already in use", "CONFLICT");
    }
  },
};
