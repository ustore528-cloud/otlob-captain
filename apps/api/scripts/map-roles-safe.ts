/**
 * Safe role remapping utility for transitional RBAC rollout.
 *
 * Default mapping:
 * - STORE_ADMIN -> STORE_USER
 *
 * Notes:
 * - CUSTOMER is intentionally preserved in this phase (deprecated-active).
 * - Script is idempotent.
 * - Use --dry-run to preview without writes.
 *
 * Examples:
 * - npm run tsx ./scripts/map-roles-safe.ts -- --dry-run
 * - npm run tsx ./scripts/map-roles-safe.ts
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

async function countByRole(role: string): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM users
    WHERE role::text = ${role}
  `;
  return Number(rows[0]?.count ?? 0n);
}

async function main() {
  const dryRun = hasFlag("--dry-run");

  const beforeStoreAdmin = await countByRole("STORE_ADMIN");
  const beforeStoreUser = await countByRole("STORE_USER");
  const beforeCustomer = await countByRole("CUSTOMER");

  // eslint-disable-next-line no-console
  console.info("[map-roles-safe] before", {
    STORE_ADMIN: beforeStoreAdmin,
    STORE_USER: beforeStoreUser,
    CUSTOMER: beforeCustomer,
    dryRun,
  });

  if (!dryRun) {
    await prisma.$executeRaw`
      UPDATE users
      SET role = 'STORE_USER'::"UserRole"
      WHERE role::text = 'STORE_ADMIN'
    `;
  }

  const afterStoreAdmin = await countByRole("STORE_ADMIN");
  const afterStoreUser = await countByRole("STORE_USER");
  const afterCustomer = await countByRole("CUSTOMER");

  // eslint-disable-next-line no-console
  console.info("[map-roles-safe] after", {
    STORE_ADMIN: afterStoreAdmin,
    STORE_USER: afterStoreUser,
    CUSTOMER: afterCustomer,
    changed: dryRun ? beforeStoreAdmin : Math.max(0, beforeStoreAdmin - afterStoreAdmin),
    dryRun,
  });
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error("[map-roles-safe] failed", e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });

