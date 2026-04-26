import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

const PREFIX = "CA-" as const;

/**
 * Allocates a unique `publicOwnerCode` for a new COMPANY_ADMIN (retry on collision).
 */
export async function allocatePublicOwnerCode(
  db: PrismaClient | Prisma.TransactionClient,
): Promise<string> {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const suffix = randomBytes(4).toString("hex").toUpperCase();
    const code = `${PREFIX}${suffix}`;
    const clash = await db.user.findFirst({ where: { publicOwnerCode: code }, select: { id: true } });
    if (!clash) return code;
  }
  throw new Error("PUBLIC_OWNER_CODE_ALLOCATION_FAILED");
}
