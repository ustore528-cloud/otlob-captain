/**
 * Sets isActive=true only for the fingerprinted Company Admin used for smoke QA.
 * Does not touch roles, companyId, publicOwnerCode, or admin@example.com.
 *
 * Usage (from repo root or apps/api):
 *   npx tsx apps/api/scripts/activate-company-admin-for-smoke.ts --dry-run
 *   npx tsx apps/api/scripts/activate-company-admin-for-smoke.ts --apply
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "..", ".env"), override: true });

import { prisma } from "../src/lib/prisma.js";

const TARGET_USER_ID = "cmod43xaq0003umz43bm4ytoe";
const TARGET_EMAIL = "company.admin@example.com";
const TARGET_COMPANY_ID = "cd8xptlzhophhzlxl036ehf6g";
const TARGET_PUBLIC_OWNER_CODE = "CA-0002";
const OTHER_ADMIN_EMAIL = "admin@example.com";
const SUPER_ADMIN_EMAIL = "alkamm678@gmail.com";

const fingerprintWhere = {
  id: TARGET_USER_ID,
  email: TARGET_EMAIL,
  role: "COMPANY_ADMIN" as const,
  companyId: TARGET_COMPANY_ID,
  publicOwnerCode: TARGET_PUBLIC_OWNER_CODE,
};

function parseArgs(argv: string[]) {
  const dryRun = argv.includes("--dry-run");
  const apply = argv.includes("--apply");
  return { dryRun, apply };
}

async function main() {
  const { dryRun, apply } = parseArgs(process.argv.slice(2));
  if ((!dryRun && !apply) || (dryRun && apply)) {
    throw new Error("Specify exactly one of: --dry-run | --apply");
  }

  const masked = process.env.DATABASE_URL
    ? process.env.DATABASE_URL.replace(/:([^:@/]+)@/, ":***@")
    : "(DATABASE_URL not set)";
  // eslint-disable-next-line no-console -- CLI
  console.error(`[activate-company-admin-for-smoke] DATABASE_URL (redacted): ${masked}`);

  const target = await prisma.user.findFirst({
    where: fingerprintWhere,
    select: {
      id: true,
      email: true,
      role: true,
      companyId: true,
      publicOwnerCode: true,
      isActive: true,
    },
  });

  if (!target) {
    throw new Error(
      "Target user not found or fingerprint mismatch — refusing to proceed (no broad changes).",
    );
  }

  const [superAdmin, otherAdmin] = await Promise.all([
    prisma.user.findFirst({
      where: { email: SUPER_ADMIN_EMAIL },
      select: { id: true, email: true, role: true, isActive: true, companyId: true },
    }),
    prisma.user.findFirst({
      where: { email: OTHER_ADMIN_EMAIL },
      select: { id: true, email: true, role: true, isActive: true, companyId: true },
    }),
  ]);

  const untouchedOtherAdmin =
    otherAdmin &&
    otherAdmin.id !== target.id &&
    otherAdmin.isActive === false &&
    otherAdmin.email === OTHER_ADMIN_EMAIL;

  const superAdminOk =
    superAdmin?.role === "SUPER_ADMIN" && superAdmin.isActive === true && superAdmin.companyId === null;

  const payload = {
    mode: dryRun ? "dry-run" : "apply",
    target: {
      id: target.id,
      email: target.email,
      role: target.role,
      companyId: target.companyId,
      publicOwnerCode: target.publicOwnerCode,
      currentIsActive: target.isActive,
      proposedIsActive: true,
    },
    confirmationOtherAdminUntouched: {
      email: OTHER_ADMIN_EMAIL,
      found: Boolean(otherAdmin),
      isActive: otherAdmin?.isActive ?? null,
      id: otherAdmin?.id ?? null,
      passesCheck: Boolean(untouchedOtherAdmin),
    },
    superAdminSnapshot: superAdmin
      ? { id: superAdmin.id, email: superAdmin.email, role: superAdmin.role, isActive: superAdmin.isActive }
      : null,
    superAdminStillOk: Boolean(superAdminOk),
  };

  if (!untouchedOtherAdmin) {
    throw new Error(
      "Refusing: admin@example.com must remain inactive and distinct from target — aborting without changes.",
    );
  }
  if (!superAdminOk) {
    throw new Error("Refusing: alkamm678@gmail.com must be active SUPER_ADMIN with null companyId.");
  }

  if (dryRun) {
    // eslint-disable-next-line no-console -- CLI
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  const result = await prisma.user.updateMany({
    where: fingerprintWhere,
    data: { isActive: true },
  });

  const after = await prisma.user.findFirst({
    where: { id: TARGET_USER_ID },
    select: { isActive: true, email: true, role: true, companyId: true, publicOwnerCode: true },
  });

  const otherAfter = await prisma.user.findFirst({
    where: { email: OTHER_ADMIN_EMAIL },
    select: { isActive: true, id: true },
  });

  // eslint-disable-next-line no-console -- CLI
  console.log(
    JSON.stringify(
      {
        mode: "apply",
        updatedCount: result.count,
        targetAfter: after,
        adminExampleComStillInactive: otherAfter?.isActive === false && otherAfter.id !== TARGET_USER_ID,
      },
      null,
      2,
    ),
  );

  if (result.count !== 1) {
    throw new Error(`Expected exactly one row updated, got ${result.count}`);
  }
  if (!after?.isActive) {
    throw new Error("Target user is still inactive after update.");
  }
  if (!otherAfter || otherAfter.isActive !== false) {
    throw new Error("admin@example.com must remain inactive after apply.");
  }
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console -- CLI
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
