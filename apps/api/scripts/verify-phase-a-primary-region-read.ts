import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Phase A completion: `primaryRegion` is loadable on store and (via join) on orders.
 * Run: `npx tsx scripts/verify-phase-a-primary-region-read.ts` (from apps/api, DATABASE_URL set)
 */
async function main() {
  const withRegion = await prisma.store.findFirst({
    where: { primaryRegionId: { not: null } },
    select: {
      id: true,
      primaryRegion: {
        select: { id: true, code: true, name: true, isActive: true },
      },
    },
  });

  const orderSample = await prisma.order.findFirst({
    select: {
      id: true,
      store: {
        select: {
          id: true,
          name: true,
          primaryRegion: { select: { id: true, code: true, name: true, isActive: true } },
        },
      },
    },
  });

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ withRegion, orderSample }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
