/**
 * Production support: شركة مرتبطة بكود الصفحة العامة بدون أي فرع فعّال → فشل إنشاء الطلب مع
 * "No active branch configured for this company" (operational-store.service).
 *
 * يحدّد المستخدم (COMPANY_ADMIN) عبر `publicOwnerCode`, يطبع الشركة والفروع، ثم:
 * - إن وُجد فرع غير مفعّل فقط ← تفعيل أقدم فرع (minimal change).
 * - وإلا إن لم يُوجَد أي فرع ← إنشاء فرع افتراضي `isActive: true`.
 *
 * Usage (DATABASE_URL إنتاج من Railway أو من متغيرات الخدمة):
 *   cd apps/api
 *   npx tsx scripts/ensure-active-branch-for-public-owner-code.ts --code CA-CB46F8D2 --dry-run
 *   npx tsx scripts/ensure-active-branch-for-public-owner-code.ts --code CA-CB46F8D2 --apply
 *
 * لا يغيّر التوزيع أو التسعير أو المنطق البرمجي — بيانات فقط.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "..", ".env"), override: true });

import { prisma } from "../src/lib/prisma.js";
import { UserRole } from "@prisma/client";
import {
  DEFAULT_BRANCH_NAME_AR,
  ensureActiveBranchForCompany,
} from "../src/services/company-branch-bootstrap.service.js";

function parseArgs(argv: string[]) {
  const codeIdx = argv.indexOf("--code");
  const code = codeIdx >= 0 ? argv[codeIdx + 1]?.trim() : "";
  const dryRun = argv.includes("--dry-run");
  const apply = argv.includes("--apply");
  return { code, dryRun, apply };
}

async function main() {
  const { code, dryRun, apply } = parseArgs(process.argv.slice(2));
  if (!code) {
    console.error('Missing --code (e.g. --code CA-CB46F8D2)');
    process.exit(1);
  }
  if (dryRun === apply || (!dryRun && !apply)) {
    console.error("Specify exactly one of: --dry-run | --apply");
    process.exit(1);
  }

  const admin = await prisma.user.findFirst({
    where: {
      publicOwnerCode: code,
      role: UserRole.COMPANY_ADMIN,
      isActive: true,
      companyId: { not: null },
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      branchId: true,
      companyId: true,
      company: { select: { id: true, name: true, isActive: true } },
    },
  });

  if (!admin?.companyId || !admin.company) {
    console.error(JSON.stringify({ error: "No active COMPANY_ADMIN with this publicOwnerCode and company.", code }));
    process.exit(2);
  }

  const companyId = admin.companyId;
  const branches = await prisma.branch.findMany({
    where: { companyId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, isActive: true, createdAt: true },
  });
  const active = branches.filter((b) => b.isActive);

  console.log(
    JSON.stringify(
      {
        publicOwnerCode: code,
        company: { id: admin.company.id, name: admin.company.name, isActive: admin.company.isActive },
        companyAdmin: {
          userId: admin.id,
          fullName: admin.fullName,
          branchId: admin.branchId,
        },
        branchesTotal: branches.length,
        branchesActive: active.length,
        branches,
      },
      null,
      2,
    ),
  );

  if (active.length > 0) {
    console.log("OK — company already has at least one active branch. No DB change needed.");
    process.exit(0);
  }

  if (dryRun) {
    console.log("[dry-run] Would activate oldest inactive branch, or create a default branch if none exist.");
    if (branches.length > 0) {
      const oldest = branches[0];
      console.log(`[dry-run] Would set isActive=true on branch ${oldest.id} (${oldest.name})`);
    } else {
      console.log("[dry-run] Would CREATE new branch Main / الفرع الرئيسي for this company.");
    }
    process.exit(0);
  }

  /** --apply */
  const applied = await prisma.$transaction(async (tx) =>
    ensureActiveBranchForCompany(tx, companyId, {
      actorUserId: admin.id,
      preferredBranchName: DEFAULT_BRANCH_NAME_AR,
    }),
  );
  console.log(JSON.stringify({ applied: applied.outcome, branchId: applied.branchId }, null, 2));

  const after = await prisma.branch.count({ where: { companyId, isActive: true } });
  console.log(JSON.stringify({ activeBranchCountAfter: after }, null, 2));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
