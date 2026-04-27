/**
 * Phase 3.4.1 — Guarded apply: set user.isActive=false for every active user except
 * the approved Super Admin. No hard deletes, no other column updates. Optional dry-run.
 *
 * Env:
 *   PHASE341_KEEP_SUPER_ADMIN_EMAIL=...   (required)
 * Apply also requires:
 *   ALLOW_PHASE341_USER_CLEANUP=1
 *   --apply
 */
import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { UserRole } from "@prisma/client";
import { buildUserCleanupPlan, type UserPreviewRow } from "./lib/user-cleanup-plan.js";
import { prisma } from "../src/lib/prisma.js";

const PHASE = "3.4.1" as const;
const isMain = (() => {
  const a = process.argv[1];
  if (!a) return false;
  try {
    return fileURLToPath(import.meta.url) === path.resolve(a);
  } catch {
    return false;
  }
})();

function hasApplyFlag(): boolean {
  return process.argv.includes("--apply");
}

function countByRole(rows: { role: UserRole }[]): Record<string, number> {
  const o: Record<string, number> = {};
  for (const r of rows) {
    o[r.role] = (o[r.role] ?? 0) + 1;
  }
  return o;
}

function validatePlanForApply(
  plan: Awaited<ReturnType<typeof buildUserCleanupPlan>>,
  keepEmailLower: string,
): { ok: true; keepId: string; toDeactivate: UserPreviewRow[] } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!plan.previewValid) {
    errors.push("Plan is invalid; fix blockers first.");
    plan.blockers.forEach((b) => errors.push(b));
  }
  if (plan.summary.usersToKeep !== 1) {
    errors.push(`Expected exactly one user to keep (usersToKeep=1); got ${String(plan.summary.usersToKeep)}.`);
  }
  const keepRows = plan.users.filter((u) => u.proposedAction === "keep_super_admin");
  if (keepRows.length !== 1) {
    errors.push(`Expected exactly one keep_super_admin row; got ${String(keepRows.length)}.`);
  }
  const toDeactivate = plan.users.filter((u) => u.proposedAction === "deactivate_user");
  const keepId = plan.keepUserId;
  if (!keepId) {
    errors.push("keepUserId is null.");
    return { ok: false, errors };
  }
  for (const d of toDeactivate) {
    if (d.userId === keepId) {
      errors.push(`Refusing: deactivation list includes the Super Admin to keep (userId ${keepId}).`);
      break;
    }
    if (d.email && d.email.toLowerCase() === keepEmailLower) {
      errors.push(
        `Refusing: deactivation list includes a user with the approved Super Admin email (userId ${d.userId}).`,
      );
      break;
    }
  }
  if (keepRows[0] && keepRows[0].userId !== keepId) {
    errors.push("Internal consistency: keep row userId != keepUserId.");
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, keepId, toDeactivate };
}

function printDryRun(
  plan: Awaited<ReturnType<typeof buildUserCleanupPlan>>,
  toDeactivate: UserPreviewRow[],
  inactive: UserPreviewRow[],
) {
  // eslint-disable-next-line no-console
  console.log(`\n======== Phase ${PHASE} user cleanup: DRY-RUN ========\n`);
  // eslint-disable-next-line no-console
  console.log("noDatabaseWrites: true\n");
  if (!plan.previewValid) {
    // eslint-disable-next-line no-console
    console.log("Blockers (apply will be refused):");
    plan.blockers.forEach((b) => console.log(`  - ${b}`));
  }
  // eslint-disable-next-line no-console
  console.log("Approved Super Admin to keep (from plan):");
  const k = plan.users.find((u) => u.proposedAction === "keep_super_admin");
  if (k) {
    // eslint-disable-next-line no-console
    console.log(
      `  userId: ${k.userId}\n  email: ${k.email ?? "(null)"}\n  fullName: ${k.fullName}\n  role: ${k.role}\n  isActive: ${String(k.isActive)}`,
    );
  } else {
    // eslint-disable-next-line no-console
    console.log("  (none — plan invalid or user not in keep role)");
  }
  if (!plan.previewValid) {
    const activeBlocked = plan.users.filter((u) => u.isActive);
    // eslint-disable-next-line no-console
    console.log(
      "\nActive users in DB (deactivation not finalized until plan is valid):",
      activeBlocked.length,
    );
    for (const u of activeBlocked) {
      // eslint-disable-next-line no-console
      console.log(
        `  - ${u.email ?? u.phone}  id=${u.userId}  role=${u.role}  proposedAction=${u.proposedAction}`,
      );
    }
  } else {
    // eslint-disable-next-line no-console
    console.log("\nActive users that would be deactivated:", toDeactivate.length);
    for (const u of toDeactivate) {
      // eslint-disable-next-line no-console
      console.log(
        `  - ${u.email ?? u.phone}  id=${u.userId}  role=${u.role}  fullName=${u.fullName}  isActive=${String(u.isActive)}`,
      );
    }
  }
  // eslint-disable-next-line no-console
  console.log("\nAlready inactive (no change in apply):", inactive.length);
  for (const u of inactive) {
    // eslint-disable-next-line no-console
    console.log(`  - ${u.email ?? u.phone}  id=${u.userId}  role=${u.role}`);
  }
  if (plan.previewValid) {
    // eslint-disable-next-line no-console
    console.log("\nCounts by role (deactivation candidates):", JSON.stringify(countByRole(toDeactivate), null, 2));
    // eslint-disable-next-line no-console
    console.log("\nRisk notes (per deactivation target):");
    for (const u of toDeactivate) {
      // eslint-disable-next-line no-console
      console.log(`  [${u.userId}] ${u.riskNote}`);
    }
  } else {
    // eslint-disable-next-line no-console
    console.log("\nCounts by role: N/A (plan invalid).");
  }
  // eslint-disable-next-line no-console
  console.log(
    "\n----------------------------------------------------------------\nSummary:",
    plan.summary,
    "\n",
  );
}

function main() {
  void (async () => {
    const apply = hasApplyFlag();
    const allow = (process.env.ALLOW_PHASE341_USER_CLEANUP ?? "").trim() === "1";
    const emailRaw = process.env.PHASE341_KEEP_SUPER_ADMIN_EMAIL;
    const keepEmailLower = (emailRaw ?? "").trim().toLowerCase();

    const plan = await buildUserCleanupPlan({
      keepEmailRaw: emailRaw,
      phase: PHASE,
      envVarName: "PHASE341_KEEP_SUPER_ADMIN_EMAIL",
    });

    const toDeactivate = plan.users.filter((u) => u.proposedAction === "deactivate_user");
    const alreadyInactive = plan.users.filter(
      (u) => u.proposedAction === "remain_inactive" || (!plan.previewValid && !u.isActive),
    );
    if (plan.previewValid) {
      const onlyInactive = plan.users.filter((u) => u.proposedAction === "remain_inactive");
      printDryRun(plan, toDeactivate, onlyInactive);
    } else {
      printDryRun(plan, toDeactivate, plan.users.filter((u) => !u.isActive));
    }

    if (!apply) {
      if (!plan.previewValid) process.exitCode = 1;
      return;
    }

    if (!allow) {
      // eslint-disable-next-line no-console
      console.error("Apply refused: set ALLOW_PHASE341_USER_CLEANUP=1");
      process.exitCode = 1;
      return;
    }

    const v = validatePlanForApply(plan, keepEmailLower);
    if (!v.ok) {
      v.errors.forEach((e) => console.error(e));
      process.exitCode = 1;
      return;
    }

    const ids = v.toDeactivate.map((r) => r.userId);
    const beforeActive = await prisma.user.count({ where: { isActive: true } });
    const beforeList = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, email: true, role: true, fullName: true },
    });

    // eslint-disable-next-line no-console
    console.log("\n======== APPLY (transactional) ========\n");
    // eslint-disable-next-line no-console
    console.log("Before: active user count =", beforeActive);
    // eslint-disable-next-line no-console
    console.log("Before: active user ids =", beforeList.map((r) => r.id).join(", "));

    const snapshots = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, isActive: true, updatedAt: true, email: true, role: true, fullName: true },
    });
    const snapById = new Map(snapshots.map((s) => [s.id, s]));
    for (const id of ids) {
      if (!snapById.has(id)) {
        throw new Error(`Refusing: user ${id} missing from database (expected in deactivation set).`);
      }
    }

    const deactivatedIds: string[] = [];
    const skippedIds: string[] = [];

    await prisma.$transaction(async (tx) => {
      for (const id of ids) {
        const s = snapById.get(id);
        if (!s) throw new Error(`internal: ${id}`);
        if (id === v.keepId) {
          throw new Error(`Refusing: deactivation set contains keep id ${id}`);
        }
        if (s.email && s.email.toLowerCase() === keepEmailLower) {
          throw new Error(`Refusing: deactivation set contains keep email (userId ${id})`);
        }
        if (!s.isActive) {
          skippedIds.push(id);
          continue;
        }
        const res = await tx.user.updateMany({
          where: { id, isActive: true, updatedAt: s.updatedAt },
          data: { isActive: false },
        });
        if (res.count === 0) {
          const cur = await tx.user.findUnique({
            where: { id },
            select: { isActive: true, updatedAt: true },
          });
          if (cur && !cur.isActive) {
            skippedIds.push(id);
            continue;
          }
          throw new Error(
            `Refusing: user ${id} changed since pre-transaction snapshot (isActive/updatedAt drift). Re-run dry-run and retry.`,
          );
        }
        deactivatedIds.push(id);
      }
    });

    const afterActive = await prisma.user.count({ where: { isActive: true } });
    const afterList = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, email: true, role: true, fullName: true },
    });
    const keep = await prisma.user.findUnique({ where: { id: v.keepId }, select: { id: true, email: true, isActive: true } });

    // eslint-disable-next-line no-console
    console.log("\nAfter: active user count =", afterActive);
    // eslint-disable-next-line no-console
    console.log("After: active user(s) =", JSON.stringify(afterList, null, 2));
    // eslint-disable-next-line no-console
    console.log("\nDeactivated user ids (this run):", deactivatedIds.length ? deactivatedIds.join(", ") : "(none new)");
    // eslint-disable-next-line no-console
    console.log("Skipped (already inactive at transaction):", skippedIds.length ? skippedIds.join(", ") : "(none)");

    if (!keep?.isActive) {
      // eslint-disable-next-line no-console
      console.error("ERROR: Approved Super Admin is not active after apply.");
      process.exitCode = 1;
    }
    if (afterActive !== 1 || afterList.length !== 1 || afterList[0]?.id !== v.keepId) {
      // eslint-disable-next-line no-console
      console.error("ERROR: Post-apply verification: expected exactly one active user (the approved Super Admin).");
      process.exitCode = 1;
    } else {
      // eslint-disable-next-line no-console
      console.log("\nPost-apply: OK — single active user matches approved Super Admin.");
    }

    // eslint-disable-next-line no-console
    console.log(
      "\nRun `npm run verify:phase0:tenant-negative -w @captain/api` to confirm tenant-negative gate still passes.\n",
    );
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
