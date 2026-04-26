/**
 * Phase 0 (read-only): audit order/store/company/branch tenant mismatches.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "..", ".env"), override: true });

const prisma = new PrismaClient();

async function main() {
  const branchCompanyMismatch = await prisma.$queryRaw<
    Array<{ order_id: string; order_company_id: string; branch_company_id: string }>
  >`
    SELECT o.id AS order_id, o.company_id AS order_company_id, b.company_id AS branch_company_id
    FROM orders o
    JOIN branches b ON b.id = o.branch_id
    WHERE o.archived_at IS NULL
      AND b.company_id IS DISTINCT FROM o.company_id
    ORDER BY o.created_at DESC
    LIMIT 500
  `;

  const storeCompanyMismatch = await prisma.$queryRaw<
    Array<{ order_id: string; order_company_id: string; store_company_id: string }>
  >`
    SELECT o.id AS order_id, o.company_id AS order_company_id, s.company_id AS store_company_id
    FROM orders o
    JOIN stores s ON s.id = o.store_id
    WHERE o.archived_at IS NULL
      AND s.company_id IS DISTINCT FROM o.company_id
    ORDER BY o.created_at DESC
    LIMIT 500
  `;

  const orderStoreBranchDrift = await prisma.$queryRaw<
    Array<{ order_id: string; order_branch_id: string; store_branch_id: string; store_id: string }>
  >`
    SELECT o.id AS order_id, o.branch_id AS order_branch_id, s.branch_id AS store_branch_id, o.store_id AS store_id
    FROM orders o
    JOIN stores s ON s.id = o.store_id
    WHERE o.archived_at IS NULL
      AND s.branch_id IS DISTINCT FROM o.branch_id
    ORDER BY o.created_at DESC
    LIMIT 500
  `;

  const payload = {
    generatedAt: new Date().toISOString(),
    counts: {
      crossCompanyViaBranch: branchCompanyMismatch.length,
      crossCompanyViaStore: storeCompanyMismatch.length,
      orderBranchDifferentFromStoreBranch: orderStoreBranchDrift.length,
    },
    details: {
      crossCompanyViaBranch: branchCompanyMismatch,
      crossCompanyViaStore: storeCompanyMismatch,
      orderBranchDifferentFromStoreBranch: orderStoreBranchDrift,
    },
  };

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(payload, null, 2));
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
