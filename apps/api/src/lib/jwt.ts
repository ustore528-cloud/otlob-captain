import jwt, { type SignOptions } from "jsonwebtoken";
import type { UserRole } from "@prisma/client";
import { env } from "../config/env.js";
import type { AppRole } from "./rbac-roles.js";

export type AccessTokenPayload = {
  sub: string;
  role: AppRole;
  /** أول متجر يملكه المستخدم (دور STORE) — للتفويض السريع */
  storeId: string | null;
  /** نطاق شركة/فرع — قد يكون null في رموز قديمة؛ يُستكمل من قاعدة البيانات عند الحاجة */
  companyId: string | null;
  branchId: string | null;
  typ: "access";
};

export type RefreshTokenPayload = {
  sub: string;
  typ: "refresh";
};

function sign(payload: object, secret: string, expiresIn: string): string {
  const options: SignOptions = { expiresIn: expiresIn as SignOptions["expiresIn"] };
  return jwt.sign(payload, secret, options);
}

export function signAccessToken(payload: Omit<AccessTokenPayload, "typ">): string {
  return sign(
    {
      ...payload,
      companyId: payload.companyId ?? null,
      branchId: payload.branchId ?? null,
      typ: "access",
    } satisfies AccessTokenPayload,
    env.JWT_ACCESS_SECRET,
    env.JWT_ACCESS_EXPIRES_IN,
  );
}

export function signRefreshToken(userId: string): string {
  return sign({ sub: userId, typ: "refresh" } satisfies RefreshTokenPayload, env.JWT_REFRESH_SECRET, env.JWT_REFRESH_EXPIRES_IN);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as jwt.JwtPayload;
  if (decoded.typ !== "access" || !decoded.sub || !decoded.role) throw new Error("Invalid access token");
  return {
    sub: decoded.sub,
    role: decoded.role as AppRole,
    storeId: (decoded.storeId as string | null | undefined) ?? null,
    companyId: (decoded.companyId as string | null | undefined) ?? null,
    branchId: (decoded.branchId as string | null | undefined) ?? null,
    typ: "access",
  };
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as jwt.JwtPayload;
  if (decoded.typ !== "refresh" || !decoded.sub) throw new Error("Invalid refresh token");
  return { sub: decoded.sub, typ: "refresh" };
}
