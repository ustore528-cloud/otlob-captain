/**
 * Idempotent QA-STRESS multitenant seed (local / Railway pre-launch only).
 *
 * Usage:
 *   cd apps/api
 *   npx tsx scripts/qa-stress-seed.ts --dry-run
 *   QA_STRESS_CONFIRM=YES npx tsx scripts/qa-stress-seed.ts --apply --companies=10 --branches-per-company=2 --captains-per-company=5 --orders-per-company=30
 *
 * Requires DATABASE_URL (apps/api/.env). Apply mode requires QA_STRESS_CONFIRM=YES.
 * No destructive migrations. Does not delete non-QA data.
 */
import { DeliveryFeeRoundingMode, DeliveryPricingMode, Prisma, UserRole } from "@prisma/client";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "..", ".env"), override: true });

import { prisma } from "../src/lib/prisma.js";
import { hashPassword } from "../src/lib/password.js";
import {
  captainFullName,
  branchName,
  companyAdminFullName,
  companyCodeFromIndex,
  companyName,
  coordsForCompanyBranch,
  orderNumber,
  QA_STRESS_CUSTOMER_NAME,
  QA_STRESS_NOTES,
  storeName,
} from "./qa-stress-constants.js";

type Counts = {
  companies: { created: number; reused: number };
  branches: { created: number; reused: number };
  stores: { created: number; reused: number };
  companyAdmins: { created: number; reused: number };
  captains: { created: number; reused: number };
  captainUsers: { created: number; reused: number };
  orders: { created: number; reused: number };
  deliverySettings: { created: number; reused: number };
};

function parseArgs() {
  const dryRun = process.argv.includes("--dry-run");
  const apply = process.argv.includes("--apply");
  let companies = 10;
  let branchesPerCompany = 2;
  let captainsPerCompany = 5;
  let ordersPerCompany = 30;
  for (const a of process.argv) {
    if (a.startsWith("--companies=")) companies = Number(a.split("=").at(-1));
    if (a.startsWith("--branches-per-company=")) branchesPerCompany = Number(a.split("=").at(-1));
    if (a.startsWith("--captains-per-company=")) captainsPerCompany = Number(a.split("=").at(-1));
    if (a.startsWith("--orders-per-company=")) ordersPerCompany = Number(a.split("=").at(-1));
  }
  if (!Number.isFinite(companies) || companies < 1 || companies > 99) throw new Error("Invalid --companies");
  if (!Number.isFinite(branchesPerCompany) || branchesPerCompany < 1 || branchesPerCompany > 99) {
    throw new Error("Invalid --branches-per-company");
  }
  if (!Number.isFinite(captainsPerCompany) || captainsPerCompany < 1 || captainsPerCompany > 99) {
    throw new Error("Invalid --captains-per-company");
  }
  if (!Number.isFinite(ordersPerCompany) || ordersPerCompany < 1 || ordersPerCompany > 9999) {
    throw new Error("Invalid --orders-per-company");
  }
  return { dryRun, apply, companies, branchesPerCompany, captainsPerCompany, ordersPerCompany };
}

function maskDbHost(raw: string | undefined): string {
  if (!raw?.trim()) return "(DATABASE_URL unset)";
  try {
    const u = new URL(raw.trim());
    return u.hostname || "(unknown host)";
  } catch {
    return "(DATABASE_URL unparsable — host hidden)";
  }
}

let syntheticPhoneSeq = 9_010_001;

function nextSyntheticPhone(): string {
  syntheticPhoneSeq += 1;
  return `+966590${String(syntheticPhoneSeq).padStart(7, "0")}`;
}

async function printSafetyBanner(params: {
  companies: number;
  branchesPerCompany: number;
  captainsPerCompany: number;
  ordersPerCompany: number;
  dryRun: boolean;
}) {
  const url = process.env.DATABASE_URL;
  // eslint-disable-next-line no-console -- CLI
  console.error("[qa-stress-seed] ========== SAFETY ==========");
  // eslint-disable-next-line no-console -- CLI
  console.error(`[qa-stress-seed] DATABASE host: ${maskDbHost(url)}`);
  // eslint-disable-next-line no-console -- CLI
  console.error(`[qa-stress-seed] NODE_ENV: ${process.env.NODE_ENV ?? "(unset)"}`);
  if (process.env.NODE_ENV === "production") {
    // eslint-disable-next-line no-console -- CLI
    console.error(
      "[qa-stress-seed] WARNING: NODE_ENV=production — ensure this database is not shared with real customers.",
    );
  }
  // eslint-disable-next-line no-console -- CLI
  console.error(`[qa-stress-seed] QA_STRESS_CONFIRM: ${process.env.QA_STRESS_CONFIRM ?? "(unset)"}`);
  // eslint-disable-next-line no-console -- CLI
  console.error(`[qa-stress-seed] Mode: ${params.dryRun ? "DRY-RUN (no writes)" : "APPLY"}`);
  // eslint-disable-next-line no-console -- CLI
  console.error(`[qa-stress-seed] Companies to ensure: ${params.companies}`);
  // eslint-disable-next-line no-console -- CLI
  console.error(`[qa-stress-seed] Branches per company: ${params.branchesPerCompany} (total ${params.companies * params.branchesPerCompany})`);
  // eslint-disable-next-line no-console -- CLI
  console.error(`[qa-stress-seed] Captains per company: ${params.captainsPerCompany} (total ${params.companies * params.captainsPerCompany})`);
  // eslint-disable-next-line no-console -- CLI
  console.error(`[qa-stress-seed] Stores: ${params.companies * params.branchesPerCompany} (one per branch)`);
  // eslint-disable-next-line no-console -- CLI
  console.error(`[qa-stress-seed] Orders per company: ${params.ordersPerCompany} (total ${params.companies * params.ordersPerCompany})`);
  // eslint-disable-next-line no-console -- CLI
  console.error("[qa-stress-seed] ============================");
}

async function main() {
  const { dryRun, apply, companies, branchesPerCompany, captainsPerCompany, ordersPerCompany } = parseArgs();
  if (dryRun && apply) {
    // eslint-disable-next-line no-console -- CLI
    console.error("Pass either --dry-run or --apply, not both.");
    process.exit(1);
  }
  if (!dryRun && !apply) {
    // eslint-disable-next-line no-console -- CLI
    console.error("Usage: --dry-run | --apply [...]. See script header.");
    process.exit(1);
  }

  await printSafetyBanner({ companies, branchesPerCompany, captainsPerCompany, ordersPerCompany, dryRun });

  if (!dryRun && process.env.QA_STRESS_CONFIRM !== "YES") {
    // eslint-disable-next-line no-console -- CLI
    console.error("[qa-stress-seed] Refusing --apply without QA_STRESS_CONFIRM=YES");
    process.exit(1);
  }

  const defaultPasswordPlain = process.env.QA_STRESS_DEFAULT_PASSWORD ?? "QaStress_Seed_Not4Prod!";
  const passwordHash = dryRun ? "" : await hashPassword(defaultPasswordPlain);

  const counts: Counts = {
    companies: { created: 0, reused: 0 },
    branches: { created: 0, reused: 0 },
    stores: { created: 0, reused: 0 },
    companyAdmins: { created: 0, reused: 0 },
    captains: { created: 0, reused: 0 },
    captainUsers: { created: 0, reused: 0 },
    orders: { created: 0, reused: 0 },
    deliverySettings: { created: 0, reused: 0 },
  };

  const errors: string[] = [];

  async function ensureCompany(ci: number) {
    const name = companyName(ci);
    if (dryRun) return { id: `dry-co-${ci}`, name };
    let row = await prisma.company.findFirst({ where: { name } });
    if (!row) {
      row = await prisma.company.create({ data: { name, isActive: true } });
      counts.companies.created += 1;
    } else {
      counts.companies.reused += 1;
    }
    return row;
  }

  async function ensureDeliverySettings(companyId: string) {
    if (dryRun) return;
    const existing = await prisma.deliverySettings.findUnique({ where: { companyId } });
    if (existing) {
      counts.deliverySettings.reused += 1;
      return;
    }
    await prisma.deliverySettings.create({
      data: {
        companyId,
        deliveryPricingMode: DeliveryPricingMode.FIXED,
        fixedDeliveryFee: new Prisma.Decimal("18.50"),
        deliveryFeeRoundingMode: DeliveryFeeRoundingMode.CEIL,
        defaultDeliveryFee: new Prisma.Decimal("18.50"),
      },
    });
    counts.deliverySettings.created += 1;
  }

  async function ensureBranch(companyId: string, ci: number, bi: number) {
    const name = branchName(ci, bi);
    if (dryRun) return { id: `dry-br-${ci}-${bi}`, companyId, name };
    let b = await prisma.branch.findFirst({ where: { companyId, name } });
    if (!b) {
      b = await prisma.branch.create({
        data: { companyId, name, isActive: true },
      });
      counts.branches.created += 1;
    } else {
      counts.branches.reused += 1;
    }
    return b;
  }

  async function ensureCompanyAdmin(companyId: string, ci: number) {
    const fullName = companyAdminFullName(ci);
    const publicOwnerCode = `qao${String(ci).padStart(3, "0")}${companyId.replace(/-/g, "").slice(0, 12)}`.slice(0, 64);
    if (dryRun) return { id: `dry-ca-${ci}`, companyId };
    let u = await prisma.user.findFirst({
      where: { companyId, role: UserRole.COMPANY_ADMIN, fullName },
    });
    if (!u) {
      u = await prisma.user.findFirst({
        where: {
          role: UserRole.COMPANY_ADMIN,
          companyId,
          email: { startsWith: `qa-stress-c${String(ci).padStart(3, "0")}-admin@` },
        },
      });
    }
    const email = `qa-stress-c${String(ci).padStart(3, "0")}-admin@stress.local.invalid`;
    if (!u) {
      u = await prisma.user.create({
        data: {
          fullName,
          phone: nextSyntheticPhone(),
          email,
          passwordHash,
          role: UserRole.COMPANY_ADMIN,
          isActive: true,
          companyId,
          publicOwnerCode,
        },
      });
      counts.companyAdmins.created += 1;
    } else {
      counts.companyAdmins.reused += 1;
      if (!u.publicOwnerCode) {
        await prisma.user.update({
          where: { id: u.id },
          data: { publicOwnerCode: `qasc-${String(ci).padStart(3, "0")}` },
        });
      }
    }
    return u;
  }

  async function ensureStore(ci: number, bi: number, companyId: string, branchId: string, ownerUserId: string) {
    const name = storeName(ci, bi);
    if (dryRun) return { id: `dry-st-${ci}-${bi}`, companyId, branchId };
    let s = await prisma.store.findFirst({ where: { companyId, branchId, name } });
    const { pickupLat, pickupLng } = coordsForCompanyBranch(ci, bi);
    if (!s) {
      const coords = coordsForCompanyBranch(ci, bi);
      s = await prisma.store.create({
        data: {
          name,
          phone: nextSyntheticPhone(),
          area: "QA-STRESS",
          address: `${name} QA address`,
          isActive: true,
          companyId,
          branchId,
          latitude: coords.pickupLat,
          longitude: coords.pickupLng,
          ownerUserId,
        },
      });
      counts.stores.created += 1;
    } else {
      counts.stores.reused += 1;
      await prisma.store.update({
        where: { id: s.id },
        data: {
          latitude: pickupLat,
          longitude: pickupLng,
        },
      }).catch(() => undefined);
    }
    return s;
  }

  async function ensureCaptain(ci: number, capIdx: number, companyId: string, branchId: string, createdByUserId: string) {
    const fullName = captainFullName(ci, capIdx);
    if (dryRun) return;
    let u = await prisma.user.findFirst({
      where: { fullName, role: UserRole.CAPTAIN, companyId },
    });
    if (!u) {
      u = await prisma.user.create({
        data: {
          fullName,
          phone: nextSyntheticPhone(),
          email: `qa-stress-c${String(ci).padStart(3, "0")}-cap-${String(capIdx).padStart(3, "0")}@stress.local.invalid`,
          passwordHash,
          role: UserRole.CAPTAIN,
          isActive: true,
          companyId,
          branchId,
        },
      });
      counts.captainUsers.created += 1;
    } else {
      counts.captainUsers.reused += 1;
      await prisma.user
        .update({
          where: { id: u.id },
          data: { companyId, branchId, isActive: true },
        })
        .catch(() => undefined);
    }

    const capExisting = await prisma.captain.findUnique({ where: { userId: u.id } });
    const coords = coordsForCompanyBranch(ci, (capIdx % branchesPerCompany) + 1);
    if (!capExisting) {
      await prisma.captain.create({
        data: {
          userId: u.id,
          companyId,
          branchId,
          vehicleType: "motorcycle",
          area: `QA-STRESS-${companyCodeFromIndex(ci)}`,
          isActive: true,
          availabilityStatus: "OFFLINE",
          prepaidEnabled: false,
          minimumBalanceToReceiveOrders: new Prisma.Decimal("0"),
          createdByUserId,
        },
      });
      counts.captains.created += 1;
    } else {
      counts.captains.reused += 1;
      await prisma.captain.update({
        where: { id: capExisting.id },
        data: {
          companyId,
          branchId,
          minimumBalanceToReceiveOrders: new Prisma.Decimal("0"),
        },
      }).catch(() => undefined);
    }
    await prisma.captainLocation
      .create({
        data: {
          captainId: (await prisma.captain.findUniqueOrThrow({ where: { userId: u.id } })).id,
          latitude: coords.pickupLat,
          longitude: coords.pickupLng,
        },
      })
      .catch(() => undefined);
  }

  try {
    for (let ci = 1; ci <= companies; ci++) {
      const company = await ensureCompany(ci);
      const companyId = company.id;
      await ensureDeliverySettings(companyId);
      const admin = await ensureCompanyAdmin(companyId, ci);

      const branchRows: { id: string }[] = [];
      for (let bi = 1; bi <= branchesPerCompany; bi++) {
        const br = await ensureBranch(companyId, ci, bi);
        branchRows.push(br);
      }

      const storeByBranchIdx: Record<number, string> = {};
      for (let bi = 1; bi <= branchesPerCompany; bi++) {
        const br = branchRows[bi - 1];
        const st = await ensureStore(ci, bi, companyId, br!.id, admin.id);
        storeByBranchIdx[bi] = st.id;
      }

      for (let capIdx = 1; capIdx <= captainsPerCompany; capIdx++) {
        const branchIdx = ((capIdx - 1) % branchesPerCompany) + 1;
        const branchId = branchRows[branchIdx - 1]!.id;
        await ensureCaptain(ci, capIdx, companyId, branchId, admin.id);
      }

      const adminUserForCreatedBy =
        dryRun ?
          ({ id: "dry-admin" } as { id: string })
        : await prisma.user.findFirstOrThrow({
            where: { companyId, fullName: companyAdminFullName(ci) },
            select: { id: true },
          });

      for (let oi = 1; oi <= ordersPerCompany; oi++) {
        const ordNo = orderNumber(ci, oi);
        const branchIdx = ((oi - 1) % branchesPerCompany) + 1;
        const branchId = branchRows[branchIdx - 1]!.id;
        const storeId = storeByBranchIdx[branchIdx];
        if (!storeId) {
          errors.push(`Missing store for company ${ci} branch slot ${branchIdx}`);
          continue;
        }
        const coord = coordsForCompanyBranch(ci, branchIdx);

        if (dryRun) continue;

        const existing = await prisma.order.findUnique({
          where: { orderNumber: ordNo },
        });
        if (existing) {
          counts.orders.reused += 1;
          continue;
        }

        await prisma.order
          .create({
            data: {
              orderNumber: ordNo,
              displayOrderNo: 900000 + oi,
              customerName: QA_STRESS_CUSTOMER_NAME,
              customerPhone: `+966588${String(ci).padStart(2, "0")}${String(oi).padStart(6, "0")}`,
              companyId,
              branchId,
              storeId,
              pickupAddress: `QA-STRESS pickup ${companyCodeFromIndex(ci)}-${oi}`,
              dropoffAddress: `QA-STRESS dropoff ${companyCodeFromIndex(ci)}-${oi}`,
              pickupLat: coord.pickupLat,
              pickupLng: coord.pickupLng,
              dropoffLat: coord.dropoffLat,
              dropoffLng: coord.dropoffLng,
              area: "QA-STRESS",
              amount: new Prisma.Decimal("900.01"),
              cashCollection: new Prisma.Decimal("0"),
              deliveryFee: new Prisma.Decimal("22.75"),
              notes: QA_STRESS_NOTES,
              distributionMode: "AUTO",
              status: "PENDING",
              createdByUserId: adminUserForCreatedBy.id,
              ownerUserId: admin.id,
            },
          })
          .then(() => {
            counts.orders.created += 1;
          })
          .catch((e) => {
            errors.push(`Order ${ordNo}: ${(e as Error).message}`);
          });
      }
    }
  } catch (e) {
    errors.push((e as Error).message);
  }

  const summary = { counts, errors, dryRun, companies, branchesPerCompany, captainsPerCompany, ordersPerCompany };

  await fs.mkdir(path.resolve(process.cwd(), "tmp"), { recursive: true }).catch(() => undefined);
  const outPath = path.resolve(process.cwd(), "tmp", "qa-stress-seed-summary.json");
  await fs.writeFile(outPath, JSON.stringify(summary, null, 2), "utf8");

  // eslint-disable-next-line no-console -- CLI
  console.error(`[qa-stress-seed] counts: ${JSON.stringify(counts)}`);
  // eslint-disable-next-line no-console -- CLI
  console.error(`[qa-stress-seed] errors (${errors.length}):`, errors.slice(0, 20));
  // eslint-disable-next-line no-console -- CLI
  console.error(`[qa-stress-seed] summary json: ${outPath}`);
  // eslint-disable-next-line no-console -- CLI
  console.error("[qa-stress-seed] default login password env override: QA_STRESS_DEFAULT_PASSWORD (only printed on stderr: not logged here)");

  if (errors.length > 0) process.exit(1);
}

await main();
