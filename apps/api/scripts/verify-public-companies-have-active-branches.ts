/**
 * PHASE 7 — Every active COMPANY_ADMIN with publicOwnerCode → company must have ≥1 active branch.
 * Exit 0 = OK — exit 1 = violations list (readonly).
 *
 * Usage:
 *   DATABASE_URL=… npx tsx apps/api/scripts/verify-public-companies-have-active-branches.ts
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { UserRole } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "..", ".env"), override: true });

import { prisma } from "../src/lib/prisma.js";

async function main() {
  const admins = await prisma.user.findMany({
    where: {
      role: UserRole.COMPANY_ADMIN,
      isActive: true,
      publicOwnerCode: { not: null },
    },
    select: {
      id: true,
      fullName: true,
      publicOwnerCode: true,
      companyId: true,
      company: { select: { id: true, name: true } },
    },
  });

  const companyIds = [...new Set(admins.map((a) => a.companyId ?? "").filter(Boolean))];
  const violations: unknown[] = [];

  for (const a of admins) {
    if (!a.companyId) {
      violations.push({
        kind: "COMPANY_ADMIN_MISSING_COMPANY_ID",
        userId: a.id,
        publicOwnerCode: a.publicOwnerCode,
      });
      continue;
    }

    const n = await prisma.branch.count({
      where: { companyId: a.companyId, isActive: true },
    });
    if (n === 0) {
      violations.push({
        kind: "NO_ACTIVE_BRANCH_FOR_PUBLIC_OWNER_COMPANY",
        userId: a.id,
        publicOwnerCode: a.publicOwnerCode,
        companyId: a.companyId,
        companyName: a.company?.name ?? null,
      });
    }
  }

  if (violations.length > 0) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          generatedAt: new Date().toISOString(),
          distinctCompaniesDerived: companyIds.length,
          violationCount: violations.length,
          violations,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        generatedAt: new Date().toISOString(),
        distinctCompaniesDerived: companyIds.length,
        checkedCompanyAdmins: admins.length,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
