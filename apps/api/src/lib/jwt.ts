import jwt, { type SignOptions } from "jsonwebtoken";
import type { UserRole } from "@prisma/client";
import { env } from "../config/env.js";

export type AccessTokenPayload = {
  sub: string;
  role: UserRole;
  /** أول متجر يملكه المستخدم (دور STORE) — للتفويض السريع */
  storeId: string | null;
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
  return sign({ ...payload, typ: "access" } satisfies AccessTokenPayload, env.JWT_ACCESS_SECRET, env.JWT_ACCESS_EXPIRES_IN);
}

export function signRefreshToken(userId: string): string {
  return sign({ sub: userId, typ: "refresh" } satisfies RefreshTokenPayload, env.JWT_REFRESH_SECRET, env.JWT_REFRESH_EXPIRES_IN);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as jwt.JwtPayload;
  if (decoded.typ !== "access" || !decoded.sub || !decoded.role) throw new Error("Invalid access token");
  return {
    sub: decoded.sub,
    role: decoded.role as UserRole,
    storeId: (decoded.storeId as string | null | undefined) ?? null,
    typ: "access",
  };
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as jwt.JwtPayload;
  if (decoded.typ !== "refresh" || !decoded.sub) throw new Error("Invalid refresh token");
  return { sub: decoded.sub, typ: "refresh" };
}
