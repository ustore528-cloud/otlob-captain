import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";
import { env } from "../src/config/env.js";

type Provider = "EXPO" | "FCM" | "UNKNOWN";

function inferProvider(token: string): Provider {
  if (/^ExponentPushToken\[.+\]$/.test(token) || /^ExpoPushToken\[.+\]$/.test(token)) return "EXPO";
  if (/^[A-Za-z0-9:_-]{80,}$/.test(token)) return "FCM";
  return "UNKNOWN";
}

function maskToken(token: string): string {
  if (token.length <= 24) return `${token.slice(0, 8)}...`;
  return `${token.slice(0, 18)}...${token.slice(-6)}`;
}

async function main(): Promise<void> {
  if (env.NODE_ENV === "production") {
    console.error("[inspect-active-captain-push-tokens] refused: NODE_ENV is production");
    process.exit(1);
  }
  const dbSource = process.env.REMOTE_DATABASE_URL?.trim() ? "REMOTE_DATABASE_URL" : "DATABASE_URL(.env)";
  // eslint-disable-next-line no-console
  console.info("[inspect-active-captain-push-tokens] db_source", { dbSource });
  const firstArg = process.argv[2]?.trim();
  const secondArg = process.argv[3]?.trim();
  const limit =
    firstArg && /^\d+$/.test(firstArg)
      ? Math.max(1, Number(firstArg))
      : secondArg && /^\d+$/.test(secondArg)
        ? Math.max(1, Number(secondArg))
        : 20;
  const lookup = firstArg && !/^\d+$/.test(firstArg) ? firstArg : undefined;

  const rows = await prisma.captainPushToken.findMany({
    where: {
      isActive: true,
      ...(lookup
        ? {
            user: {
              OR: [{ id: lookup }, { phone: lookup }, { email: lookup }, { captain: { id: lookup } }],
            },
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      token: true,
      platform: true,
      isActive: true,
      lastSeenAt: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          phone: true,
          email: true,
          captain: { select: { id: true, companyId: true } },
        },
      },
    },
  });

  console.info("[inspect-active-captain-push-tokens] rows", {
    lookup: lookup ?? null,
    count: rows.length,
    rows: rows.map((r) => ({
      captainId: r.user.captain?.id ?? null,
      companyId: r.user.captain?.companyId ?? null,
      userId: r.user.id,
      phone: r.user.phone,
      email: r.user.email,
      token: maskToken(r.token),
      provider: inferProvider(r.token),
      platform: r.platform,
      isActive: r.isActive,
      lastSeenAt: r.lastSeenAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
  });
}

void main();
