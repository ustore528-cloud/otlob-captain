/**
 * Option A: main platform owner as SUPER_ADMIN (alkamm678@gmail.com),
 * dedicated COMPANY_ADMIN for default company, legacy captain ownership, disable demo admin@.
 *
 * Secrets only via environment variables in --apply (never printed, logged, or committed to git):
 *   ALKAMM_SUPER_ADMIN_PASSWORD
 *   ALKAMM_SUPER_ADMIN_PHONE      — required if alkamm user does not exist (unique in DB, E.164)
 *   DEFAULT_TENANT_ADMIN_EMAIL
 *   DEFAULT_TENANT_ADMIN_PHONE
 *   DEFAULT_TENANT_ADMIN_PASSWORD
 * Optional:
 *   SKIP_DISABLE_DEMO_ADMIN=1     — do not set admin@example.com isActive false on --apply
 *
 * Password safety (operational):
 *   - Do not use weak, example, or previously shared passwords; if a password was exposed, generate new strong secrets before --apply.
 *   - Prefer long random unique passwords (this script enforces length ≥8; prefer 16+ via a password manager).
 *   - Set all required env vars in the same shell session immediately before --apply.
 *
 * No broad backfill. Smoke Company B is not touched. This script does not deploy to production.
 *
 * Usage:
 *   npx tsx apps/api/scripts/apply-final-superadmin-companyadmin-setup.ts --dry-run
 *   npx tsx apps/api/scripts/apply-final-superadmin-companyadmin-setup.ts --apply
 */
import "dotenv/config";
import { UserRole } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";
import { hashPassword } from "../src/lib/password.js";

const isDry = process.argv.includes("--dry-run");
const isApply = process.argv.includes("--apply");

if (isDry && isApply) {
  // eslint-disable-next-line no-console
  console.error("Use either --dry-run or --apply.");
  process.exit(1);
}
if (!isDry && !isApply) {
  // eslint-disable-next-line no-console
  console.error("Pass --dry-run or --apply.");
  process.exit(1);
}

const SUPER_ADMIN_EMAIL = "alkamm678@gmail.com";
const SUPER_ADMIN_FULL_NAME = "مدير المنصة";
const DEFAULT_COMPANY_ID = "cd8xptlzhophhzlxl036ehf6g";
const DEFAULT_COMPANY_NAME = "الشركة الافتراضية";
const TENANT_ADMIN_FULL_NAME = "مدير الشركة الافتراضية";
const DEMO_ADMIN_EMAIL = "admin@example.com";
const SMOKE_COMPANY_B_ID = "cmob0w0bz0002umiweako63e2";
const CAPTAIN_IDS = [
  "cmo9ng14u0005um84b49d1f4a",
  "cmo9ng2b60008um84id4o4496",
  "cmob0w3cp000oumiwvrvsk73h",
] as const;

type DryReport = {
  at: string;
  mode: "dry-run" | "apply";
  superAdmin: {
    email: string;
    userExists: boolean;
    currentUser: null | { id: string; role: string; companyId: string | null; branchId: string | null; isActive: boolean };
    proposed: { role: string; fullName: string; companyId: null; branchId: null };
  };
  demoAdmin: {
    current: null | { id: string; email: string; role: string; companyId: string | null; branchId: string | null; isActive: boolean; fullName: string };
    proposed: string;
  };
  tenantAdmin: {
    dedicatedCompanyId: string;
    companyName: string;
    status: "need_contact_from_env" | "will_create" | "will_update_by_email" | "missing_env_on_apply";
    targetEmail: string | null;
    createOrUpdate: string;
  };
  captains: {
    ids: string[];
    proposedOwner: "dedicated_tenant_COMPANY_ADMIN_id_after_create";
  };
  smoke: { action: "no_changes"; companyId: string };
  broadBackfill: { run: "never" };
  applyEnv: {
    alkammPasswordSet: boolean;
    alkammPhoneInEnv: boolean;
    tenantEmailSet: boolean;
    tenantPhoneSet: boolean;
    tenantPasswordSet: boolean;
  };
};

function envSet(k: string): boolean {
  return Boolean(process.env[k]?.trim());
}

function applyEnvSnapshot() {
  return {
    alkammPasswordSet: envSet("ALKAMM_SUPER_ADMIN_PASSWORD"),
    alkammPhoneInEnv: envSet("ALKAMM_SUPER_ADMIN_PHONE"),
    tenantEmailSet: envSet("DEFAULT_TENANT_ADMIN_EMAIL"),
    tenantPhoneSet: envSet("DEFAULT_TENANT_ADMIN_PHONE"),
    tenantPasswordSet: envSet("DEFAULT_TENANT_ADMIN_PASSWORD"),
  };
}

async function buildReport(): Promise<DryReport> {
  const alkamm = await prisma.user.findFirst({ where: { email: SUPER_ADMIN_EMAIL } });
  const demo = await prisma.user.findFirst({ where: { email: DEMO_ADMIN_EMAIL } });
  const tenantEmail = process.env.DEFAULT_TENANT_ADMIN_EMAIL?.trim() ?? null;
  const canApplyTenant = envSet("DEFAULT_TENANT_ADMIN_EMAIL") && envSet("DEFAULT_TENANT_ADMIN_PHONE") && envSet("DEFAULT_TENANT_ADMIN_PASSWORD");
  const existingByTenantEmail = tenantEmail
    ? await prisma.user.findFirst({ where: { email: tenantEmail } })
    : null;

  const tenantStatus: DryReport["tenantAdmin"]["status"] = (() => {
    if (isApply && !canApplyTenant) return "missing_env_on_apply";
    if (!tenantEmail) return "need_contact_from_env";
    if (!canApplyTenant) return "need_contact_from_env";
    return existingByTenantEmail ? "will_update_by_email" : "will_create";
  })();

  return {
    at: new Date().toISOString(),
    mode: isDry ? "dry-run" : "apply",
    superAdmin: {
      email: SUPER_ADMIN_EMAIL,
      userExists: Boolean(alkamm),
      currentUser: alkamm
        ? {
            id: alkamm.id,
            role: alkamm.role,
            companyId: alkamm.companyId,
            branchId: alkamm.branchId,
            isActive: alkamm.isActive,
          }
        : null,
      proposed: { role: "SUPER_ADMIN", fullName: SUPER_ADMIN_FULL_NAME, companyId: null, branchId: null },
    },
    demoAdmin: {
      current: demo
        ? {
            id: demo.id,
            email: demo.email!,
            role: demo.role,
            companyId: demo.companyId,
            branchId: demo.branchId,
            isActive: demo.isActive,
            fullName: demo.fullName,
          }
        : null,
      proposed: envSet("SKIP_DISABLE_DEMO_ADMIN")
        ? "keep active (SKIP_DISABLE_DEMO_ADMIN=1); not platform owner; prefer dedicated tenant admin for captains"
        : "set isActive=false (demo/legacy; main owner is SUPER_ADMIN on alkamm678@gmail.com) unless that user is the dedicated tenant (same id)",
    },
    tenantAdmin: {
      dedicatedCompanyId: DEFAULT_COMPANY_ID,
      companyName: DEFAULT_COMPANY_NAME,
      status: tenantStatus,
      targetEmail: process.env.DEFAULT_TENANT_ADMIN_EMAIL?.trim() ?? null,
      createOrUpdate: `COMPANY_ADMIN, fullName="${TENANT_ADMIN_FULL_NAME}", companyId=${DEFAULT_COMPANY_ID}, branchId=null`,
    },
    captains: { ids: [...CAPTAIN_IDS], proposedOwner: "dedicated_tenant_COMPANY_ADMIN_id_after_create" },
    smoke: { action: "no_changes", companyId: SMOKE_COMPANY_B_ID },
    broadBackfill: { run: "never" },
    applyEnv: applyEnvSnapshot(),
  };
}

async function runApply() {
  const e = applyEnvSnapshot();
  if (!e.alkammPasswordSet) {
    // eslint-disable-next-line no-console
    throw new Error("Set ALKAMM_SUPER_ADMIN_PASSWORD in the environment (apply only, never commit).");
  }
  if (!e.tenantEmailSet || !e.tenantPhoneSet || !e.tenantPasswordSet) {
    // eslint-disable-next-line no-console
    throw new Error("Set DEFAULT_TENANT_ADMIN_EMAIL, DEFAULT_TENANT_ADMIN_PHONE, DEFAULT_TENANT_ADMIN_PASSWORD before --apply.");
  }
  const alkammExisting = await prisma.user.findFirst({ where: { email: SUPER_ADMIN_EMAIL } });
  if (!alkammExisting && !e.alkammPhoneInEnv) {
    // eslint-disable-next-line no-console
    throw new Error("User for alkamm678@gmail.com does not exist. Set unique ALKAMM_SUPER_ADMIN_PHONE for the new account.");
  }

  const passSuper = process.env.ALKAMM_SUPER_ADMIN_PASSWORD!.trim();
  const passTen = process.env.DEFAULT_TENANT_ADMIN_PASSWORD!.trim();
  const hashSuper = await hashPassword(passSuper);
  const hashTen = await hashPassword(passTen);
  if (passSuper.length < 8 || passTen.length < 8) {
    // eslint-disable-next-line no-console
    throw new Error("Passwords must be at least 8 characters (align with dashboard policy).");
  }

  const phoneTen = process.env.DEFAULT_TENANT_ADMIN_PHONE!.trim();
  const emailTen = process.env.DEFAULT_TENANT_ADMIN_EMAIL!.trim();
  if (emailTen.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
    // eslint-disable-next-line no-console
    throw new Error("DEFAULT_TENANT_ADMIN_EMAIL must not be the same as the SUPER_ADMIN email.");
  }

  await prisma.$transaction(async (tx) => {
    if (alkammExisting) {
      await tx.user.update({
        where: { id: alkammExisting.id },
        data: {
          role: UserRole.SUPER_ADMIN,
          fullName: SUPER_ADMIN_FULL_NAME,
          companyId: null,
          branchId: null,
          isActive: true,
          passwordHash: hashSuper,
        },
      });
    } else {
      await tx.user.create({
        data: {
          email: SUPER_ADMIN_EMAIL,
          fullName: SUPER_ADMIN_FULL_NAME,
          role: UserRole.SUPER_ADMIN,
          companyId: null,
          branchId: null,
          isActive: true,
          phone: process.env.ALKAMM_SUPER_ADMIN_PHONE!.trim(),
          passwordHash: hashSuper,
        },
      });
    }

    const superRow = await tx.user.findFirstOrThrow({ where: { email: SUPER_ADMIN_EMAIL } });

    const tenantByEmail = await tx.user.findFirst({ where: { email: emailTen } });
    let tenantId: string;
    if (tenantByEmail) {
      if (tenantByEmail.id === superRow.id) {
        // eslint-disable-next-line no-console
        throw new Error("DEFAULT_TENANT_ADMIN_EMAIL must not resolve to the SUPER_ADMIN user.");
      }
      const t = await tx.user.update({
        where: { id: tenantByEmail.id },
        data: {
          role: UserRole.COMPANY_ADMIN,
          fullName: TENANT_ADMIN_FULL_NAME,
          companyId: DEFAULT_COMPANY_ID,
          branchId: null,
          isActive: true,
          passwordHash: hashTen,
          phone: phoneTen,
        },
      });
      tenantId = t.id;
    } else {
      const t = await tx.user.create({
        data: {
          email: emailTen,
          fullName: TENANT_ADMIN_FULL_NAME,
          role: UserRole.COMPANY_ADMIN,
          companyId: DEFAULT_COMPANY_ID,
          branchId: null,
          isActive: true,
          phone: phoneTen,
          passwordHash: hashTen,
        },
      });
      tenantId = t.id;
    }

    for (const cid of CAPTAIN_IDS) {
      const cap = await tx.captain.findUnique({ where: { id: cid } });
      if (!cap) {
        // eslint-disable-next-line no-console
        throw new Error(`Captain not found: ${cid}`);
      }
      if (cap.companyId !== DEFAULT_COMPANY_ID) {
        // eslint-disable-next-line no-console
        throw new Error(`Captain ${cid} is not in default company; abort (Smoke unchanged).`);
      }
      await tx.captain.update({
        where: { id: cid },
        data: { createdByUserId: tenantId },
      });
    }

    if (!envSet("SKIP_DISABLE_DEMO_ADMIN")) {
      const demo = await tx.user.findFirst({ where: { email: DEMO_ADMIN_EMAIL } });
      if (demo && demo.id !== tenantId) {
        await tx.user.update({
          where: { id: demo.id },
          data: { isActive: false },
        });
      }
    }
  });
}

async function main() {
  const report = await buildReport();

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        ...report,
        superAdmin: {
          ...report.superAdmin,
          applyNote: isApply
            ? undefined
            : "Passwords are never printed. --apply: set ALKAMM_SUPER_ADMIN_PASSWORD; if no alkamm user yet, set ALKAMM_SUPER_ADMIN_PHONE; set DEFAULT_TENANT_ADMIN_* for dedicated tenant admin.",
        },
        confirmation: {
          smokeCompanyB: "Unmodified (no read/write to Smoke in this script except ID constant in report).",
          broadBackfillApply: "Not run; not part of this script.",
        },
      },
      (k, v) => (typeof v === "bigint" ? v.toString() : v),
      2,
    ),
  );

  if (isApply) {
    await runApply();
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        { ok: true, at: new Date().toISOString(), message: "apply completed. Change passwords after first login. Never committed secrets." },
        null,
        2,
      ),
    );
  } else {
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        { note: "dry-run only — no database changes. Set tenant admin envs before --apply, or you will be prompted by apply failure." },
        null,
        2,
      ),
    );
  }
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
