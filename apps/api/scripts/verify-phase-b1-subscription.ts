import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Phase B1 preview: confirm subscription columns + enum exist and seed store is PUBLIC.
 * Run: npx tsx scripts/verify-phase-b1-subscription.ts (from apps/api, DATABASE_URL set)
 */
async function main() {
  const migration = await prisma.$queryRaw<
    { migration_name: string; finished_at: Date | null }[]
  >`SELECT migration_name, finished_at FROM _prisma_migrations WHERE migration_name = '20260424120000_phase_b1_store_subscription_type'`;

  const store = await prisma.store.findUnique({
    where: { id: "seed-store-main" },
    select: {
      id: true,
      subscriptionType: true,
      supervisorUserId: true,
    },
  });

  const byType = await prisma.store.groupBy({
    by: ["subscriptionType"],
    _count: { id: true },
  });

  console.log(
    JSON.stringify(
      {
        b1Migration: migration,
        seedStoreSubscription: store,
        storeCountBySubscriptionType: byType,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
