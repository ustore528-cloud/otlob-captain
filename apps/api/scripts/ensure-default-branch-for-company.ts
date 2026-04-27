/**
 * Local/dev: ensure a company has at least one active branch so Company Admin can add captains.
 * Does not relax tenant rules — only inserts Branch rows (city/zone optional per schema).
 *
 * Usage (from repo root):
 *   npx tsx apps/api/scripts/ensure-default-branch-for-company.ts --diagnose
 *   npx tsx apps/api/scripts/ensure-default-branch-for-company.ts --company-id=<cuid>
 *   QA_COMPANY_ID=<cuid> npx tsx apps/api/scripts/ensure-default-branch-for-company.ts
 *
 * Optional: --dry-run (no write)
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { PrismaClient, UserRole } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "..", ".env"), override: true });

const prisma = new PrismaClient();

const DEFAULT_BRANCH_NAME_AR = "الفرع الافتراضي";

function parseArgs(argv: string[]) {
  let diagnose = false;
  let dryRun = false;
  let companyId: string | undefined;
  for (const a of argv) {
    if (a === "--diagnose") diagnose = true;
    else if (a === "--dry-run") dryRun = true;
    else if (a.startsWith("--company-id=")) companyId = a.slice("--company-id=".length).trim() || undefined;
  }
  companyId = companyId ?? (process.env.QA_COMPANY_ID?.trim() || undefined);
  return { diagnose, dryRun, companyId };
}

async function main() {
  const { diagnose, dryRun, companyId } = parseArgs(process.argv.slice(2));

  if (diagnose) {
    const admins = await prisma.user.findMany({
      where: { role: UserRole.COMPANY_ADMIN, isActive: true, companyId: { not: null } },
      select: {
        id: true,
        fullName: true,
        phone: true,
        companyId: true,
        branchId: true,
        company: { select: { name: true, isActive: true } },
      },
    });
    const report = [];
    for (const u of admins) {
      const cid = u.companyId!;
      const activeBranches = await prisma.branch.count({
        where: { companyId: cid, isActive: true },
      });
      const anyBranches = await prisma.branch.count({ where: { companyId: cid } });
      report.push({
        companyAdminUserId: u.id,
        companyId: cid,
        companyName: u.company?.name,
        companyActive: u.company?.isActive,
        adminBranchIdOnUser: u.branchId,
        activeBranchCount: activeBranches,
        totalBranchCount: anyBranches,
        blocker: activeBranches === 0 ? "NO_ACTIVE_BRANCH — run with --company-id=" + cid : null,
      });
    }
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ generatedAt: new Date().toISOString(), diagnose: true, admins: report }, null, 2));
    return;
  }

  if (!companyId) {
    // eslint-disable-next-line no-console
    console.error(
      "Set --company-id=<cuid> or QA_COMPANY_ID, or run with --diagnose to list Company Admins and branch counts.",
    );
    process.exitCode = 1;
    return;
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, isActive: true },
  });
  if (!company) {
    // eslint-disable-next-line no-console
    console.error(`Company not found: ${companyId}`);
    process.exitCode = 1;
    return;
  }
  if (!company.isActive) {
    // eslint-disable-next-line no-console
    console.error(`Company ${companyId} is not active — refusing to add branch.`);
    process.exitCode = 1;
    return;
  }

  const existingActive = await prisma.branch.findMany({
    where: { companyId, isActive: true },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  if (existingActive.length > 0) {
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          ok: true,
          skipped: true,
          reason: "Company already has active branch(es)",
          companyId,
          companyName: company.name,
          branches: existingActive,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (dryRun) {
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          ok: true,
          dryRun: true,
          wouldCreate: { companyId, name: DEFAULT_BRANCH_NAME_AR, isActive: true },
        },
        null,
        2,
      ),
    );
    return;
  }

  const created = await prisma.branch.create({
    data: {
      companyId,
      name: DEFAULT_BRANCH_NAME_AR,
      isActive: true,
    },
    select: { id: true, name: true, companyId: true, isActive: true, createdAt: true },
  });

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        ok: true,
        created: true,
        branch: created,
        company: { id: company.id, name: company.name },
        note: "Reload /captains as Company Admin — branch picker should populate; single branch auto-selected.",
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
