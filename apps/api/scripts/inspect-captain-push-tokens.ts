/**
 * Dev-only: print captain + captain_push_tokens rows for debugging registration.
 * Pass captain `userId`, captain `id`, or captain account phone.
 *
 * Usage:
 *   npx tsx scripts/inspect-captain-push-tokens.ts <userId|captainId|phone>
 */
import "dotenv/config";
import { env } from "../src/config/env.js";
import { prisma } from "../src/lib/prisma.js";

function maskToken(t: string): string {
  if (t.length <= 24) return `${t.slice(0, 8)}…`;
  return `${t.slice(0, 18)}…${t.slice(-6)}`;
}

async function main(): Promise<void> {
  if (env.NODE_ENV === "production") {
    // eslint-disable-next-line no-console
    console.error("[inspect-captain-push-tokens] refused: NODE_ENV is production");
    process.exit(1);
  }
  const arg = process.argv[2]?.trim();
  if (!arg) {
    // eslint-disable-next-line no-console
    console.error(
      "[inspect-captain-push-tokens] usage: npx tsx scripts/inspect-captain-push-tokens.ts <userId|captainId|phone>",
    );
    process.exit(1);
  }

  const captain = await prisma.captain.findFirst({
    where: {
      OR: [{ id: arg }, { userId: arg }, { user: { phone: arg } }, { user: { email: arg } }],
    },
    select: {
      id: true,
      userId: true,
      user: { select: { phone: true, email: true } },
    },
  });

  if (!captain) {
    // eslint-disable-next-line no-console
    console.info("[inspect-captain-push-tokens] captain_not_found", { lookup: arg });
    process.exit(2);
  }

  const rows = await prisma.captainPushToken.findMany({
    where: { userId: captain.userId },
    orderBy: { updatedAt: "desc" },
  });

  // eslint-disable-next-line no-console
  console.info("[inspect-captain-push-tokens] captain", {
    captainId: captain.id,
    captainUserId: captain.userId,
    phone: captain.user.phone,
    email: captain.user.email,
  });
  // eslint-disable-next-line no-console
  console.info("[inspect-captain-push-tokens] tokens", {
    count: rows.length,
    rows: rows.map((r) => ({
      id: r.id,
      platform: r.platform,
      isActive: r.isActive,
      appVersion: r.appVersion,
      lastSeenAt: r.lastSeenAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      token: maskToken(r.token),
    })),
  });
}

void main();
