/**
 * Read-only post-setup verification. No secrets in output.
 * Usage: npx tsx apps/api/scripts/verify-post-superadmin-setup.ts
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "..", ".env"), override: true });

import { prisma } from "../src/lib/prisma.js";

const CAPTAIN_IDS = [
  "cmo9ng14u0005um84b49d1f4a",
  "cmo9ng2b60008um84id4o4496",
  "cmob0w3cp000oumiwvrvsk73h",
] as const;
const SMOKE_CAPTAIN_ID = "cmob0w3or000qumiwdy75aj55";
const DEFAULT_COMPANY_ID = "cd8xptlzhophhzlxl036ehf6g";
const SMOKE_COMPANY_ID = "cmob0w0bz0002umiweako63e2";

async function main() {
  const [alkamm, tenant, adminDemo] = await Promise.all([
    prisma.user.findFirst({
      where: { email: "alkamm678@gmail.com" },
      select: { id: true, email: true, role: true, companyId: true, branchId: true, isActive: true },
    }),
    prisma.user.findFirst({
      where: { email: "company.admin@example.com" },
      select: { id: true, email: true, role: true, companyId: true, branchId: true, isActive: true },
    }),
    prisma.user.findFirst({
      where: { email: "admin@example.com" },
      select: { id: true, email: true, role: true, isActive: true, companyId: true },
    }),
  ]);

  const caps = await prisma.captain.findMany({
    where: { id: { in: [...CAPTAIN_IDS] } },
    select: { id: true, companyId: true, createdByUserId: true },
  });
  const smokeCaptain = await prisma.captain.findFirst({
    where: { id: SMOKE_CAPTAIN_ID },
    select: { id: true, companyId: true, createdByUserId: true },
  });

  const checks = {
    at: new Date().toISOString(),
    alkamm678: {
      found: Boolean(alkamm),
      roleIsSuperAdmin: alkamm?.role === "SUPER_ADMIN",
      companyIdNull: alkamm?.companyId === null,
      branchIdNull: alkamm?.branchId === null,
      isActive: alkamm?.isActive === true,
      publicFields: alkamm
        ? { id: alkamm.id, email: alkamm.email, role: alkamm.role, companyId: alkamm.companyId, branchId: alkamm.branchId, isActive: alkamm.isActive }
        : null,
    },
    companyAdminDedicated: {
      found: Boolean(tenant),
      roleIsCompanyAdmin: tenant?.role === "COMPANY_ADMIN",
      companyIdMatchesDefault: tenant?.companyId === DEFAULT_COMPANY_ID,
      isActive: tenant?.isActive === true,
      branchId: tenant?.branchId ?? null,
      publicFields: tenant
        ? { id: tenant.id, email: tenant.email, role: tenant.role, companyId: tenant.companyId, branchId: tenant.branchId, isActive: tenant.isActive }
        : null,
    },
    adminExampleCom: {
      found: Boolean(adminDemo),
      isActive: adminDemo?.isActive,
      /** `admin@example.com` must stay inactive when it is a separate row from the dedicated tenant admin. */
      isInactiveWhenSeparateFromTenant:
        adminDemo && tenant && adminDemo.id !== tenant.id ? adminDemo.isActive === false : true,
      isInactiveUnlessReused: adminDemo
        ? adminDemo.isActive === false || adminDemo.id === tenant?.id
        : null,
      sameUserAsTenantAdmin: adminDemo && tenant ? adminDemo.id === tenant.id : false,
      publicFields: adminDemo
        ? { id: adminDemo.id, email: adminDemo.email, isActive: adminDemo.isActive, role: adminDemo.role }
        : null,
    },
    defaultCaptains: {
      expectedCount: CAPTAIN_IDS.length,
      foundCount: caps.length,
      allHaveOwner: caps.every((c) => c.createdByUserId !== null),
      allOwnerMatchesTenant: tenant ? caps.every((c) => c.createdByUserId === tenant.id) : false,
      detail: caps.map((c) => ({ captainId: c.id, createdByUserId: c.createdByUserId, companyId: c.companyId })),
    },
    smoke: {
      smokeCaptain: smokeCaptain
        ? {
            id: smokeCaptain.id,
            companyId: smokeCaptain.companyId,
            createdByUserId: smokeCaptain.createdByUserId,
            stillInSmokeCompany: smokeCaptain.companyId === SMOKE_COMPANY_ID,
            ownershipStillNull: smokeCaptain.createdByUserId === null,
          }
        : null,
      smokeUnchanged: smokeCaptain
        ? smokeCaptain.companyId === SMOKE_COMPANY_ID && smokeCaptain.createdByUserId === null
        : false,
    },
  };

  const allOk =
    checks.alkamm678.roleIsSuperAdmin === true &&
    checks.alkamm678.companyIdNull === true &&
    checks.alkamm678.branchIdNull === true &&
    checks.alkamm678.isActive === true &&
    checks.companyAdminDedicated.roleIsCompanyAdmin === true &&
    checks.companyAdminDedicated.companyIdMatchesDefault === true &&
    checks.companyAdminDedicated.found === true &&
    checks.companyAdminDedicated.isActive === true &&
    checks.adminExampleCom.isInactiveWhenSeparateFromTenant === true &&
    checks.adminExampleCom.isInactiveUnlessReused === true &&
    checks.defaultCaptains.allHaveOwner === true &&
    checks.defaultCaptains.allOwnerMatchesTenant === true &&
    checks.smoke.smokeUnchanged === true;

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      { ...checks, summary: { allChecksPass: allOk, note: "No password or hash fields queried or printed." } },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
