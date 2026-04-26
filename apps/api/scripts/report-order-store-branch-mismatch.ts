/** One-off read-only: orders where order.branch_id != store.branch_id */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "..", ".env"), override: true });

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRaw<
    Array<{
      order_id: string;
      order_company_id: string;
      order_branch_id: string;
      store_id: string;
      store_branch_id: string;
      store_company_id: string;
      status: string;
      created_at: Date;
      created_by_user_id: string | null;
      order_owner_user_id: string | null;
    }>
  >`
    SELECT o.id AS order_id,
           o.company_id AS order_company_id,
           o.branch_id AS order_branch_id,
           o.store_id AS store_id,
           s.branch_id AS store_branch_id,
           s.company_id AS store_company_id,
           o.status::text AS status,
           o.created_at AS created_at,
           o.created_by_user_id AS created_by_user_id,
           o.order_owner_user_id AS order_owner_user_id
    FROM orders o
    JOIN stores s ON s.id = o.store_id
    WHERE o.archived_at IS NULL
      AND s.branch_id IS DISTINCT FROM o.branch_id
    ORDER BY o.created_at ASC
  `;
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(rows, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
