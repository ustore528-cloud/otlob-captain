/**
 * Targeted, reviewed-only assignment of `captains.created_by_user_id` for legacy rows.
 * Does NOT infer ownership. Apply only after explicit { captainId, ownerUserId } review.
 *
 * Usage:
 *   npx tsx apps/api/scripts/assign-legacy-captain-owners.ts --dry-run --file path/to/mappings.json
 *   npx tsx apps/api/scripts/assign-legacy-captain-owners.ts --apply --file path/to/mappings.json
 *
 * mappings.json:
 *   [ { "captainId": "cuid", "ownerUserId": "cuid" }, ... ]
 *
 * Optional: --map cuid1:cuid2  (repeatable, same as one row in the array)
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { UserRole } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";

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

type Mapping = { captainId: string; ownerUserId: string };

function parseArgs(): Mapping[] {
  const maps: Mapping[] = [];
  for (let i = 0; i < process.argv.length; i += 1) {
    if (process.argv[i] === "--file" && process.argv[i + 1]) {
      const raw = JSON.parse(fs.readFileSync(path.resolve(process.argv[i + 1]!), "utf8")) as unknown;
      i += 1;
      if (Array.isArray(raw)) {
        for (const r of raw) {
          if (r && typeof r === "object" && "captainId" in r && "ownerUserId" in r) {
            maps.push({
              captainId: String((r as Mapping).captainId),
              ownerUserId: String((r as Mapping).ownerUserId),
            });
          }
        }
      }
    } else if (process.argv[i] === "--map" && process.argv[i + 1]) {
      const [c, o] = process.argv[i + 1]!.split(":");
      if (c && o) maps.push({ captainId: c.trim(), ownerUserId: o.trim() });
      i += 1;
    }
  }
  if (maps.length === 0) {
    // eslint-disable-next-line no-console
    console.error("No mappings. Use --file mappings.json and/or --map captainId:ownerUserId");
    process.exit(1);
  }
  const seen = new Set<string>();
  for (const m of maps) {
    if (seen.has(m.captainId)) {
      // eslint-disable-next-line no-console
      console.error(`Duplicate captainId: ${m.captainId}`);
      process.exit(1);
    }
    seen.add(m.captainId);
  }
  return maps;
}

async function validate(m: Mapping): Promise<{ ok: true; details: string } | { ok: false; error: string }> {
  const cap = await prisma.captain.findUnique({
    where: { id: m.captainId },
    include: { company: { select: { name: true } } },
  });
  if (!cap) return { ok: false, error: `Captain not found: ${m.captainId}` };

  const owner = await prisma.user.findUnique({
    where: { id: m.ownerUserId },
    select: { id: true, role: true, companyId: true, fullName: true, email: true, phone: true },
  });
  if (!owner) return { ok: false, error: `Owner user not found: ${m.ownerUserId}` };
  if (owner.role !== UserRole.COMPANY_ADMIN) {
    return {
      ok: false,
      error: `ownerUserId must be COMPANY_ADMIN (got ${owner.role} for ${m.ownerUserId})`,
    };
  }
  if (!owner.companyId || owner.companyId !== cap.companyId) {
    return {
      ok: false,
      error: `Owner companyId must match captain company: captain=${cap.companyId} owner=${owner.companyId ?? "null"}`,
    };
  }

  const details = [
    `captain=${m.captainId} company=${cap.company.name}(${cap.companyId})`,
    `-> owner=${m.ownerUserId} ${owner.email ?? owner.phone} ${owner.fullName}`,
    `current createdByUserId=${cap.createdByUserId ?? "null"}`,
  ].join(" | ");

  return { ok: true, details };
}

async function main() {
  const mappings = parseArgs();
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      { mode: isDry ? "dry-run" : "apply", mappingCount: mappings.length, at: new Date().toISOString() },
      null,
      2,
    ),
  );

  for (const m of mappings) {
    const v = await validate(m);
    if (!v.ok) {
      // eslint-disable-next-line no-console
      console.error("[assign-legacy-captain-owners] INVALID", m, v.error);
      process.exit(1);
    }
    // eslint-disable-next-line no-console
    console.log("[assign-legacy-captain-owners] ok", v.details);
  }

  if (isApply) {
    for (const m of mappings) {
      await prisma.captain.update({
        where: { id: m.captainId },
        data: { createdByUserId: m.ownerUserId },
      });
    }
    // eslint-disable-next-line no-console
    console.log("[assign-legacy-captain-owners] apply done", { updated: mappings.length });
  } else {
    // eslint-disable-next-line no-console
    console.log("[assign-legacy-captain-owners] dry-run only — no database changes.");
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
