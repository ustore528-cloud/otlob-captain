import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const phaseA = await prisma.$queryRaw<
    { migration_name: string; finished_at: Date | null }[]
  >`SELECT migration_name, finished_at FROM _prisma_migrations WHERE migration_name = '20260423210000_phase_a_region_store_primary'`;

  const regionCount = await prisma.region.count();
  const seedRegion = await prisma.region.findFirst({
    where: { code: "SEED-DEFAULT" },
    include: { company: { select: { id: true, name: true } } },
  });
  const store = await prisma.store.findUnique({
    where: { id: "seed-store-main" },
    select: {
      id: true,
      name: true,
      companyId: true,
      primaryRegionId: true,
      primaryRegion: { select: { id: true, code: true, name: true, isActive: true } },
    },
  });
  const anchorMatches =
    store?.primaryRegionId != null &&
    store.primaryRegionId === store.primaryRegion?.id &&
    store.companyId === seedRegion?.companyId;

  console.log(
    JSON.stringify(
      {
        phaseAMigration: phaseA,
        regionCount,
        seedRegion: seedRegion
          ? {
              id: seedRegion.id,
              code: seedRegion.code,
              companyId: seedRegion.companyId,
              isActive: seedRegion.isActive,
            }
          : null,
        storeAnchor: store,
        storeCompanyMatchesRegionCompany: anchorMatches,
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
