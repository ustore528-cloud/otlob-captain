import { UserRole } from "@prisma/client";
import { verifyPassword, hashPassword } from "../lib/password.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../lib/jwt.js";
import { env } from "../config/env.js";
import { userRepository } from "../repositories/user.repository.js";
import { captainRepository } from "../repositories/captain.repository.js";
import { AppError } from "../utils/errors.js";
import { activityService } from "./activity.service.js";

async function buildTokenPayload(userId: string, role: UserRole) {
  let storeId: string | null = null;
  if (role === UserRole.STORE) {
    storeId = await userRepository.primaryStoreIdForOwner(userId);
  }
  return { sub: userId, role, storeId };
}

function normalizeLoginIdentifiers(input: { phone?: string; email?: string; password: string }) {
  const phone = input.phone?.trim() || undefined;
  const emailRaw = input.email?.trim();
  const email = emailRaw ? emailRaw.toLowerCase() : undefined;
  return { phone, email, password: input.password };
}

export const authService = {
  async login(input: { phone?: string; email?: string; password: string }) {
    const { phone, email, password } = normalizeLoginIdentifiers(input);
    const user = phone
      ? await userRepository.findByPhone(phone)
      : email
        ? await userRepository.findByEmail(email)
        : null;
    if (!user || !user.isActive) {
      throw new AppError(401, "Invalid credentials", "INVALID_CREDENTIALS");
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) throw new AppError(401, "Invalid credentials", "INVALID_CREDENTIALS");

    const payload = await buildTokenPayload(user.id, user.role);
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(user.id);

    await activityService.log(user.id, "AUTH_LOGIN", "user", user.id, {});

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        fullName: user.fullName,
        phone: user.phone,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        storeId: payload.storeId,
      },
    };
  },

  /** تسجيل دخول مخصّص لتطبيق الكابتن — نفس JWT مع التحقق من الدور وبيانات الكابتن. */
  async loginCaptain(input: { phone?: string; email?: string; password: string }) {
    const { phone, email, password } = normalizeLoginIdentifiers(input);
    const result = await this.login({
      phone,
      email,
      password,
    });
    if (result.user.role !== UserRole.CAPTAIN) {
      throw new AppError(403, "Captain app login requires CAPTAIN role", "FORBIDDEN_ROLE");
    }
    const captain = await captainRepository.findByUserId(result.user.id);
    if (!captain) throw new AppError(403, "Captain profile not found", "FORBIDDEN");

    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      tokenType: "Bearer" as const,
      expiresIn: env.JWT_ACCESS_EXPIRES_IN,
      user: {
        id: result.user.id,
        fullName: result.user.fullName,
        phone: result.user.phone,
        role: result.user.role,
      },
      captain: {
        id: captain.id,
        vehicleType: captain.vehicleType,
        area: captain.area,
        availabilityStatus: captain.availabilityStatus,
        isActive: captain.isActive,
      },
    };
  },

  async refresh(refreshToken: string) {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new AppError(401, "Invalid refresh token", "INVALID_REFRESH");
    }
    const user = await userRepository.findById(payload.sub);
    if (!user || !user.isActive) throw new AppError(401, "User not found", "INVALID_REFRESH");
    const tokenPayload = await buildTokenPayload(user.id, user.role);
    return {
      accessToken: signAccessToken(tokenPayload),
      refreshToken: signRefreshToken(user.id),
    };
  },

  async me(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) throw new AppError(404, "User not found", "NOT_FOUND");
    const storeId = await buildTokenPayload(user.id, user.role).then((p) => p.storeId);
    return {
      id: user.id,
      fullName: user.fullName,
      phone: user.phone,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      storeId,
    };
  },

  /** تسجيل مستخدم (للتطوير/لوحة الإدارة) */
  async register(input: {
    fullName: string;
    phone: string;
    email?: string;
    password: string;
    role: UserRole;
  }) {
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
      const payload = await buildTokenPayload(user.id, user.role);
      await activityService.log(user.id, "USER_REGISTERED", "user", user.id, { role: user.role });
      return {
        accessToken: signAccessToken(payload),
        refreshToken: signRefreshToken(user.id),
        user: {
          id: user.id,
          fullName: user.fullName,
          phone: user.phone,
          email: user.email,
          role: user.role,
        },
      };
    } catch {
      throw new AppError(409, "Phone or email already in use", "CONFLICT");
    }
  },
};
