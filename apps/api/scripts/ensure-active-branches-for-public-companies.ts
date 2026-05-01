/**
 * PHASE 6 — Production-safe repair: guarantee every company with an active COMPANY_ADMIN +
 * `publicOwnerCode` has ≥1 active Branch. Only INSERT/UPDATE on `branches` (reactivate/create).
 *
 * Defaults to dry-run unless `--apply`.
 *
 *   npx tsx scripts/ensure-active-branches-for-public-companies.ts
 *   npx tsx scripts/ensure-active-branches-for-public-companies.ts --dry-run
 *   npx tsx scripts/ensure-active-branches-for-public-companies.ts --apply
 *   npx tsx scripts/ensure-active-branches-for-public-companies.ts --apply --json
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { UserRole } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "..", ".env"), override: true });

import { prisma } from "../src/lib/prisma.js";
import {
  DEFAULT_BRANCH_NAME_AR,
  ensureActiveBranchForCompany,
} from "../src/services/company-branch-bootstrap.service.js";

type RowStatus =
  | "SKIPPED_ALREADY_OK"
  | "WOULD_REACTIVATE_BRANCH"
  | "WOULD_CREATE_DEFAULT_BRANCH"
  | "REACTIVATED_BRANCH"
  | "CREATED_DEFAULT_BRANCH"
  | "ERROR_ROW";

type Row = {
  companyId: string;
  companyName: string | null;
  status: RowStatus;
  branchId?: string;
  adminsSample: Array<{ userId: string; publicOwnerCode: string | null }>;
  detail?: string;
};

function parseArgs(argv: string[]) {
  const apply = argv.includes("--apply");
  const dryRunExplicit = argv.includes("--dry-run");
  const json = argv.includes("--json");
  if (apply && dryRunExplicit) {
    console.error("Use only one of: --dry-run | --apply");
    process.exit(1);
  }
  const dryRun = !apply;
  return { apply, dryRun, json };
}

async function main() {
  const { apply, dryRun, json } = parseArgs(process.argv.slice(2));

  const admins = await prisma.user.findMany({
    where: {
      role: UserRole.COMPANY_ADMIN,
      isActive: true,
      companyId: { not: null },
      publicOwnerCode: { not: null },
    },
    select: { id: true, companyId: true, publicOwnerCode: true },
  });

  const companyIds = [...new Set(admins.map((a) => a.companyId!))];
  const companies = await prisma.company.findMany({
    where: { id: { in: companyIds } },
    select: { id: true, name: true },
  });
  const nameById = new Map(companies.map((c) => [c.id, c.name]));

  const rows: Row[] = [];
  let scanned = companyIds.length;
  let skippedAlreadyOk = 0;
  let wouldReactivate = 0;
  let wouldCreate = 0;
  let reactivated = 0;
  let created = 0;
  let errors = 0;

  const describePlan = async (companyId: string) => {
    const activeBranches = await prisma.branch.count({
      where: { companyId, isActive: true },
    });
    const totalBranches = await prisma.branch.count({
      where: { companyId },
    });
    if (activeBranches > 0) return null;
    return totalBranches > 0 ? "WOULD_REACTIVATE_BRANCH" as const : ("WOULD_CREATE_DEFAULT_BRANCH" as const);
  };

  for (const companyId of companyIds) {
    const adminsSample = admins
      .filter((a) => a.companyId === companyId)
      .slice(0, 3)
      .map((a) => ({ userId: a.id, publicOwnerCode: a.publicOwnerCode }));

    const base: Row = {
      companyId,
      companyName: nameById.get(companyId) ?? null,
      status: "SKIPPED_ALREADY_OK",
      adminsSample,
    };

    try {
      const activeBefore = await prisma.branch.count({
        where: { companyId, isActive: true },
      });

      if (activeBefore > 0) {
        base.status = "SKIPPED_ALREADY_OK";
        skippedAlreadyOk++;
        rows.push(base);
        continue;
      }

      if (dryRun) {
        const plan = await describePlan(companyId);
        if (plan === "WOULD_REACTIVATE_BRANCH") {
          base.status = "WOULD_REACTIVATE_BRANCH";
          wouldReactivate++;
        } else {
          base.status = "WOULD_CREATE_DEFAULT_BRANCH";
          wouldCreate++;
        }
        rows.push(base);
        continue;
      }

      const result = await prisma.$transaction(async (tx) =>
        ensureActiveBranchForCompany(tx, companyId, {
          preferredBranchName: DEFAULT_BRANCH_NAME_AR,
          actorUserId: adminsSample[0]?.userId ?? null,
        }),
      );
      base.branchId = result.branchId;
      if (result.outcome === "reactivated") {
        base.status = "REACTIVATED_BRANCH";
        reactivated++;
      } else if (result.outcome === "created") {
        base.status = "CREATED_DEFAULT_BRANCH";
        created++;
      } else {
        base.status = "SKIPPED_ALREADY_OK";
        skippedAlreadyOk++;
      }
      rows.push(base);
    } catch (e) {
      errors++;
      base.status = "ERROR_ROW";
      base.detail = e instanceof Error ? e.message : String(e);
      rows.push(base);
    }
  }

  const summary = {
    mode: dryRun ? "dry-run" : "apply",
    scanned,
    skippedAlreadyOk,
    ...(dryRun ? { wouldReactivate, wouldCreate } : {}),
    ...(!dryRun ? { reactivated, created } : {}),
    errors,
  };

  if (json) {
    console.log(JSON.stringify({ generatedAt: new Date().toISOString(), summary, companies: rows }, null, 2));
  } else {
    console.log("=== ensure-active-branches-for-public-companies ===");
    console.log(`generatedAt: ${new Date().toISOString()}`);
    console.log(`mode: ${summary.mode}`);
    console.log(`total companies scanned: ${scanned}`);
    console.log(`SKIPPED_ALREADY_OK: ${skippedAlreadyOk}`);
    if (dryRun) {
      console.log(`WOULD_REACTIVATE_BRANCH: ${wouldReactivate}`);
      console.log(`WOULD_CREATE_DEFAULT_BRANCH: ${wouldCreate}`);
    } else {
      console.log(`REACTIVATED_BRANCH: ${reactivated}`);
      console.log(`CREATED_DEFAULT_BRANCH: ${created}`);
    }
    console.log(`errors: ${errors}`);
    for (const r of rows) {
      if (r.status === "SKIPPED_ALREADY_OK" && !dryRun) continue;
      console.log(`- ${r.companyId} ${r.companyName ?? ""} → ${r.status}${r.branchId ? ` (${r.branchId})` : ""}`);
    }
  }

  process.exit(errors > 0 ? 2 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
