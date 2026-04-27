/**
 * Phase 3.4.0 — Dry-run preview: keep one approved Super Admin active; plan deactivation
 * of other users. No hard deletes, no isActive / DB writes in this script.
 *
 * Env (required for a valid plan):
 *   PHASE340_KEEP_SUPER_ADMIN_EMAIL=admin@example.com
 *
 * Usage:
 *   PHASE340_KEEP_SUPER_ADMIN_EMAIL=... npm run phase340:preview-user-cleanup -w @captain/api
 */
import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildUserCleanupPlan } from "./lib/user-cleanup-plan.js";
import { prisma } from "../src/lib/prisma.js";

const isMain = (() => {
  const a = process.argv[1];
  if (!a) return false;
  try {
    return fileURLToPath(import.meta.url) === path.resolve(a);
  } catch {
    return false;
  }
})();

type LegacyOutput = Awaited<ReturnType<typeof buildOutput>>;

export async function buildOutput(): Promise<LegacyOutput> {
  const p = await buildUserCleanupPlan({
    keepEmailRaw: process.env.PHASE340_KEEP_SUPER_ADMIN_EMAIL,
    phase: "3.4.0",
    envVarName: "PHASE340_KEEP_SUPER_ADMIN_EMAIL",
  });
  return {
    generatedAt: p.generatedAt,
    phase: p.phase,
    dryRun: p.dryRun,
    noDatabaseWrites: p.noDatabaseWrites,
    keepSuperAdminEmailEnv: p.keepSuperAdminEmailEnv,
    keepSuperAdminEmailUsed: p.keepSuperAdminEmailUsed,
    blockers: p.blockers,
    previewValid: p.previewValid,
    summary: p.summary,
    users: p.users,
    notes: p.notes,
  };
}

function main() {
  void (async () => {
    const out = await buildOutput();
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(out, null, 2));
    if (!out.previewValid) process.exitCode = 1;
  })()
    .catch((e) => {
      // eslint-disable-next-line no-console
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => {
      void prisma.$disconnect();
    });
}

if (isMain) {
  main();
}

export type { UserPreviewRow, ProposedAction } from "./lib/user-cleanup-plan.js";
export type { LegacyOutput as Output };
