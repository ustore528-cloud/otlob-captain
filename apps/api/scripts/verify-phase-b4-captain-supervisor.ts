import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Phase B4 preview: `captain_supervisor_user_id` column + Prisma can load `supervisorUser` summary.
 * Run: `npx tsx scripts/verify-phase-b4-captain-supervisor.ts` (from apps/api, DATABASE_URL set)
 */
async function main() {
  const migration = await prisma.$queryRaw<
    { migration_name: string; finished_at: Date | null }[]
  >`SELECT migration_name, finished_at FROM _prisma_migrations WHERE migration_name = '20260424140000_phase_b4_captain_supervisor'`;

  const sample = await prisma.captain.findFirst({
    select: {
      id: true,
      supervisorUserId: true,
      supervisorUser: {
        select: {
          id: true,
          fullName: true,
          phone: true,
          email: true,
          role: true,
          companyId: true,
          branchId: true,
        },
      },
    },
  });

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        b4Migration: migration,
        sampleCaptainSupervisor: sample,
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
