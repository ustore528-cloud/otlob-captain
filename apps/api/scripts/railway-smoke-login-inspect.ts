/**
 * Inspect (and optionally reset) smoke login accounts against the DB in DATABASE_URL.
 *
 * Usage (from apps/api):
 *   npx tsx scripts/railway-smoke-login-inspect.ts --inspect
 *   SMOKE_TEMP_PASSWORD='...' npx tsx scripts/railway-smoke-login-inspect.ts --reset
 *   npx tsx scripts/railway-smoke-login-inspect.ts --reset-auto-verify
 *     (generates a random password in-memory, resets DB, POSTs to public API — password never printed)
 */
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "..", ".env"), override: true });

import { prisma } from "../src/lib/prisma.js";
import { hashPassword } from "../src/lib/password.js";

const COMPANY_EMAIL = "alkamm1996@gmail.com";
const SUPER_EMAIL = "alkamm678@gmail.com";
const CAPTAIN_PHONE_INPUT = "0525047336";

function phoneVariants(raw: string): string[] {
  const s = raw.trim();
  const set = new Set<string>();
  set.add(s);
  set.add(s.replace(/^0/, ""));
  if (/^\d{10}$/.test(s.replace(/^\+/, ""))) set.add(`+966${s.replace(/^0/, "")}`);
  if (/^05\d{8}$/.test(s)) set.add(`+966${s.slice(1)}`);
  set.add(`+972${s.replace(/^0/, "")}`);
  set.add(`966${s.replace(/^\+/, "").replace(/^0/, "")}`);
  return [...set].filter(Boolean);
}

function maskDbUrl(): string {
  const u = process.env.DATABASE_URL ?? "";
  return u ? u.replace(/:([^:@/]+)@/, ":***@") : "(DATABASE_URL unset)";
}

async function inspect() {
  // eslint-disable-next-line no-console -- CLI
  console.error(`[railway-smoke-login-inspect] DATABASE_URL (redacted): ${maskDbUrl()}`);

  const companyUser = await prisma.user.findFirst({
    where: { email: COMPANY_EMAIL.toLowerCase() },
    select: {
      id: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      companyId: true,
      branchId: true,
    },
  });

  const superUser = await prisma.user.findFirst({
    where: { email: SUPER_EMAIL.toLowerCase() },
    select: {
      id: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      companyId: true,
      branchId: true,
    },
  });

  const variants = phoneVariants(CAPTAIN_PHONE_INPUT);
  let captainUser =
    (await prisma.user.findFirst({
      where: { phone: { in: variants } },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        companyId: true,
        branchId: true,
      },
    })) ??
    (await prisma.user.findFirst({
      where: { phone: { contains: "525047336" } },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        companyId: true,
        branchId: true,
      },
    }));

  let captainRow: { id: string; companyId: string | null; branchId: string | null } | null = null;
  if (captainUser) {
    captainRow = await prisma.captain.findUnique({
      where: { userId: captainUser.id },
      select: { id: true, companyId: true, branchId: true },
    });
  }

  return {
    companyUser,
    superUser,
    captainUser,
    captainRecord: captainRow,
    captainPhoneVariantsTried: variants,
  };
}

async function resetPasswordsForIds(userIds: string[], plain: string) {
  const hash = await hashPassword(plain);
  await prisma.$transaction(
    userIds.map((id) =>
      prisma.user.update({
        where: { id },
        data: { passwordHash: hash },
      }),
    ),
  );
}

function randomSmokePassword(): string {
  const core = randomBytes(24).toString("base64url");
  return `${core}Aa1!`;
}

function resolvePublicApiOrigin(): string {
  const raw = process.env.SMOKE_API_ORIGIN?.trim() || "https://captainapi-production.up.railway.app";
  return raw.replace(/\/+$/, "");
}

async function postLoginStatus(
  apiOrigin: string,
  body: Record<string, string>,
): Promise<number> {
  const res = await fetch(`${apiOrigin}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.status;
}

async function main() {
  const mode = process.argv.includes("--reset-auto-verify")
    ? "reset-auto-verify"
    : process.argv.includes("--reset")
      ? "reset"
      : "inspect";

  const snapshot = await inspect();

  const payload = {
    companyAdmin: snapshot.companyUser
      ? {
          found: true,
          id: snapshot.companyUser.id,
          email: snapshot.companyUser.email,
          phone: snapshot.companyUser.phone,
          role: snapshot.companyUser.role,
          isActive: snapshot.companyUser.isActive,
          companyId: snapshot.companyUser.companyId,
          branchId: snapshot.companyUser.branchId,
          roleMatchesExpected: snapshot.companyUser.role === "COMPANY_ADMIN",
        }
      : { found: false },
    superAdmin: snapshot.superUser
      ? {
          found: true,
          id: snapshot.superUser.id,
          email: snapshot.superUser.email,
          phone: snapshot.superUser.phone,
          role: snapshot.superUser.role,
          isActive: snapshot.superUser.isActive,
          companyId: snapshot.superUser.companyId,
          branchId: snapshot.superUser.branchId,
          roleMatchesExpected: snapshot.superUser.role === "SUPER_ADMIN",
        }
      : { found: false },
    captain: snapshot.captainUser
      ? {
          found: true,
          id: snapshot.captainUser.id,
          email: snapshot.captainUser.email,
          phone: snapshot.captainUser.phone,
          role: snapshot.captainUser.role,
          isActive: snapshot.captainUser.isActive,
          companyId: snapshot.captainUser.companyId,
          branchId: snapshot.captainUser.branchId,
          captainProfileId: snapshot.captainRecord?.id ?? null,
          captainCompanyId: snapshot.captainRecord?.companyId ?? null,
          captainBranchId: snapshot.captainRecord?.branchId ?? null,
          roleMatchesExpected: snapshot.captainUser.role === "CAPTAIN",
          hasCaptainProfile: Boolean(snapshot.captainRecord),
        }
      : { found: false, captainPhoneVariantsTried: snapshot.captainPhoneVariantsTried },
  };

  if (mode === "inspect") {
    // eslint-disable-next-line no-console -- CLI
    console.log(JSON.stringify(payload, null, 2));
  }

  if (mode === "reset") {
    const plain = process.env.SMOKE_TEMP_PASSWORD?.trim();
    if (!plain || plain.length < 12) {
      throw new Error(
        "Set SMOKE_TEMP_PASSWORD (min 12 chars) in the environment for --reset. Value is never printed.",
      );
    }
    const ids: string[] = [];
    if (snapshot.companyUser) ids.push(snapshot.companyUser.id);
    if (snapshot.superUser) ids.push(snapshot.superUser.id);
    if (snapshot.captainUser) ids.push(snapshot.captainUser.id);
    if (ids.length === 0) {
      throw new Error("No users found — refusing reset.");
    }
    await resetPasswordsForIds(ids, plain);
    // eslint-disable-next-line no-console -- CLI
    console.error(
      `[railway-smoke-login-inspect] password reset applied for ${ids.length} user(s). Plain password was not logged.`,
    );
  }

  if (mode === "reset-auto-verify") {
    const plain = randomSmokePassword();
    const ids: string[] = [];
    if (snapshot.companyUser) ids.push(snapshot.companyUser.id);
    if (snapshot.superUser) ids.push(snapshot.superUser.id);
    if (snapshot.captainUser) ids.push(snapshot.captainUser.id);
    if (ids.length === 0) throw new Error("No users found — refusing reset-auto-verify.");

    await resetPasswordsForIds(ids, plain);
    const pwFile = path.resolve(__dirname, "..", ".smoke-password-once");
    await fs.writeFile(pwFile, plain, "utf8");
    // eslint-disable-next-line no-console -- CLI
    console.error(
      `[railway-smoke-login-inspect] temporary password written once to ${pwFile} (delete after use). Not printed to stdout.`,
    );

    const apiOrigin = resolvePublicApiOrigin();

    const loginResults = {
      apiOrigin,
      companyAdminHttp: snapshot.companyUser
        ? await postLoginStatus(apiOrigin, {
            email: COMPANY_EMAIL.toLowerCase(),
            password: plain,
          })
        : null,
      superAdminHttp: snapshot.superUser
        ? await postLoginStatus(apiOrigin, {
            email: SUPER_EMAIL.toLowerCase(),
            password: plain,
          })
        : null,
      captainHttp: snapshot.captainUser
        ? await postLoginStatus(apiOrigin, {
            phone: snapshot.captainUser.phone,
            password: plain,
          })
        : null,
    };

    // eslint-disable-next-line no-console -- CLI
    console.log(
      JSON.stringify(
        {
          inspect: payload,
          passwordReset: {
            appliedForUserCount: ids.length,
            passwordPrinted: false,
            passwordFileRel: "apps/api/.smoke-password-once",
          },
          loginProbeAfterReset: loginResults,
        },
        null,
        2,
      ),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
