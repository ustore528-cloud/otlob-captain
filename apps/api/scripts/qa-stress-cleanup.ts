/**
 * Delete ONLY QA-STRESS synthetic data created by qa-stress-seed.ts naming rules.
 *
 * Requires QA_STRESS_CONFIRM=YES for --apply (mandatory safeguard).
 *
 * Usage:
 *   QA_STRESS_CONFIRM=YES npx tsx scripts/qa-stress-cleanup.ts --dry-run
 *   QA_STRESS_CONFIRM=YES npx tsx scripts/qa-stress-cleanup.ts --apply
 *
 * Aborts (--apply and sometimes --dry-run) if:
 *   - QA companies contain any order whose order_number does NOT start with QA-STRESS-
 *   - Any QA-STRESS-* order belongs to a company whose name does not match QA-STRESS-Company-NNN
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "..", ".env"), override: true });

import type { Prisma } from "@prisma/client";
import { UserRole } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";
import {
  QA_STRESS_CAPTAIN_NAME_RE,
  QA_STRESS_COMPANY_ADMIN_RE,
  QA_STRESS_COMPANY_NAME_RE,
  QA_STRESS_ORDER_PREFIX,
  QA_STRESS_STORE_NAME_RE,
  QA_STRESS_BRANCH_NAME_RE,
} from "./qa-stress-constants.js";

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

function parseMode(): "dry-run" | "apply" | null {
  const hasDry = process.argv.includes("--dry-run");
  const hasApply = process.argv.includes("--apply");
  if (hasDry && hasApply) return null;
  if (hasDry) return "dry-run";
  if (hasApply) return "apply";
  return null;
}

async function main() {
  const mode = parseMode();
  if (!mode) {
    console.error("Pass exactly one of --dry-run or --apply.");
    process.exit(1);
  }

  if (mode === "apply" && process.env.QA_STRESS_CONFIRM !== "YES") {
    console.error("[qa-stress-cleanup] --apply refused: set QA_STRESS_CONFIRM=YES");
    process.exit(1);
  }

  console.error("[qa-stress-cleanup] mode:", mode);

  const allQaCompanies = await prisma.company.findMany({
    where: { name: { startsWith: "QA-STRESS-Company-" } },
    select: { id: true, name: true },
  });

  const targetCompanies = allQaCompanies.filter((c) => QA_STRESS_COMPANY_NAME_RE.test(c.name));
  const looseQaCompanies = allQaCompanies.filter((c) => !QA_STRESS_COMPANY_NAME_RE.test(c.name));

  const companyIds = targetCompanies.map((c) => c.id);

  /** Hard safety gate: QA-shaped company rows must not host non-QA orders. */
  if (companyIds.length > 0) {
    const foreignOrder = await prisma.order.findFirst({
      where: {
        companyId: { in: companyIds },
        NOT: { orderNumber: { startsWith: QA_STRESS_ORDER_PREFIX } },
      },
      select: { id: true, orderNumber: true, companyId: true },
    });
    if (foreignOrder) {
      console.error(
        "[qa-stress-cleanup] BLOCKED: company has NON–QA-STRESS orders — refuse to cleanup tenant:",
        foreignOrder,
      );
      process.exit(1);
    }
  }

  const qaStressOrdersAll = await prisma.order.findMany({
    where: { orderNumber: { startsWith: QA_STRESS_ORDER_PREFIX } },
    select: {
      id: true,
      orderNumber: true,
      companyId: true,
      company: { select: { name: true } },
    },
  });

  const orphanQaOrders = qaStressOrdersAll.filter(
    (o) => !o.company?.name || !QA_STRESS_COMPANY_NAME_RE.test(o.company.name),
  );
  if (orphanQaOrders.length > 0) {
    console.error(
      `[qa-stress-cleanup] BLOCKED: ${orphanQaOrders.length} QA-STRESS-* orders are not tied to QA-STRESS-Company-NNN companies (possible data mix). First:`,
      orphanQaOrders[0],
    );
    process.exit(1);
  }

  const qaOrderIds = qaStressOrdersAll.map((o) => o.id);

  const qaStores = await prisma.store.findMany({
    where: {
      companyId: { in: companyIds },
      name: { startsWith: "QA-STRESS-" },
    },
    select: { id: true, name: true, branchId: true, ownerUserId: true },
  });
  const wellFormedStores = qaStores.filter((s) => QA_STRESS_STORE_NAME_RE.test(s.name));

  const qaBranches = await prisma.branch.findMany({
    where: { companyId: { in: companyIds }, name: { startsWith: "QA-STRESS-" } },
    select: { id: true, name: true },
  });
  const wellFormedBranches = qaBranches.filter((b) => QA_STRESS_BRANCH_NAME_RE.test(b.name));

  const qaUsers = await prisma.user.findMany({
    where: { companyId: { in: companyIds } },
    select: {
      id: true,
      fullName: true,
      role: true,
      email: true,
      phone: true,
    },
  });

  const qaCaptains = await prisma.captain.findMany({
    where: { companyId: { in: companyIds } },
    select: { id: true, userId: true },
  });
  const captainIds = qaCaptains.map((c) => c.id);
  const qaCaptainUserIds = uniqueIds(qaCaptains.map((c) => c.userId));

  const qaAdminUserIds = uniqueIds(
    qaUsers
      .filter(
        (u) =>
          u.role === UserRole.COMPANY_ADMIN &&
          (QA_STRESS_COMPANY_ADMIN_RE.test(u.fullName) || u.fullName.startsWith("QA-STRESS-")),
      )
      .map((u) => u.id),
  );

  const assignmentLogs =
    qaOrderIds.length === 0 ?
      0
    : await prisma.orderAssignmentLog.count({
        where: { orderId: { in: qaOrderIds } },
      });

  const balanceWhere =
    qaOrderIds.length > 0 && captainIds.length > 0 ?
      { OR: [{ orderId: { in: qaOrderIds } }, { captainId: { in: captainIds } }] }
    : qaOrderIds.length > 0 ?
      { orderId: { in: qaOrderIds } }
    : captainIds.length > 0 ?
      { captainId: { in: captainIds } }
    : null;
  const balTxOrders =
    balanceWhere ?
      await prisma.captainBalanceTransaction.count({ where: balanceWhere })
    : 0;

  /** All tenant wallets (company / store / captain / supervisor) share company_id — RESTRICT FK blocks company delete if any remain */
  const walletRows = await prisma.walletAccount.findMany({
    where: { companyId: { in: companyIds } },
    select: { id: true },
  });
  const walletIds = walletRows.map((w) => w.id);

  const ledgerWhereParts: Prisma.LedgerEntryWhereInput[] = [];
  if (qaOrderIds.length > 0) ledgerWhereParts.push({ orderId: { in: qaOrderIds } });
  if (walletIds.length > 0) {
    ledgerWhereParts.push(
      { walletAccountId: { in: walletIds } },
      { counterpartyAccountId: { in: walletIds } },
    );
  }
  const ledgerCount =
    ledgerWhereParts.length > 0 ?
      await prisma.ledgerEntry.count({ where: { OR: ledgerWhereParts } })
    : 0;

  const subscriptions =
    qaOrderIds.length === 0 ?
      0
    : await prisma.customerPublicPushSubscription.count({
        where: { orderId: { in: qaOrderIds } },
      });

  /** Reached only after safety gates: no non-QA orders on strict QA companies; no orphan QA-STRESS orders. */
  const nonQaRecordsAffected = false;

  const preview = {
    mode,
    targetCompaniesStrict: targetCompanies.length,
    targetCompaniesLooseSkipped: looseQaCompanies.length,
    nonQaRecordsAffected,
    ordersQaStress: qaStressOrdersAll.length,
    assignmentLogsTargetingQaOrders: assignmentLogs,
    captainBalanceTxTouchingOrdersOrCaptains: balTxOrders,
    ledgerRowsTouchingOrdersOrWallets: ledgerCount,
    customerPushSubscriptions: subscriptions,
    walletAccountsTouchingQaCompanies: walletRows.length,
    storesQaStressShaped: wellFormedStores.length,
    branchesQaStressShaped: wellFormedBranches.length,
    captains: qaCaptains.length,
    qaCaptainUserIds: qaCaptainUserIds.length,
    qaAdminUserIds: qaAdminUserIds.length,
  };

  console.error("[qa-stress-cleanup] preview counts:", JSON.stringify(preview, null, 2));

  const summaryPath = path.resolve(process.cwd(), "tmp", "qa-stress-cleanup-preview.json");
  await fs.mkdir(path.dirname(summaryPath), { recursive: true });
  await fs.writeFile(summaryPath, JSON.stringify(preview, null, 2), "utf8");
  console.error("[qa-stress-cleanup] preview json:", summaryPath);

  if (mode === "dry-run") return;

  if (companyIds.length === 0) {
    console.error("[qa-stress-cleanup] apply: no QA-STRESS-Company-NNN companies — nothing to delete.");
    return;
  }

  const notificationUserIds = uniqueIds([...qaCaptainUserIds, ...qaAdminUserIds]);

  await prisma.$transaction(
    async (tx) => {
      if (notificationUserIds.length > 0) {
        await tx.notification.deleteMany({ where: { userId: { in: notificationUserIds } } });
      }

      const activityUserTargets = uniqueIds([...qaCaptainUserIds, ...qaAdminUserIds]);
      if (activityUserTargets.length > 0) {
        await tx.activityLog.deleteMany({
          where: { userId: { in: activityUserTargets } },
        });
      }
      if (qaOrderIds.length > 0) {
        await tx.activityLog.deleteMany({
          where: { entityType: "Order", entityId: { in: qaOrderIds } },
        });
      }

      const ledgerParts: Prisma.LedgerEntryWhereInput[] = [];
      if (qaOrderIds.length > 0) ledgerParts.push({ orderId: { in: qaOrderIds } });
      if (walletIds.length > 0) {
        ledgerParts.push(
          { walletAccountId: { in: walletIds } },
          { counterpartyAccountId: { in: walletIds } },
        );
      }
      if (ledgerParts.length > 0) {
        await tx.ledgerEntry.deleteMany({ where: { OR: ledgerParts } });
      }

      if (balanceWhere) {
        await tx.captainBalanceTransaction.deleteMany({ where: balanceWhere });
      }

      if (qaOrderIds.length > 0) {
        await tx.customerPublicPushSubscription.deleteMany({
          where: { orderId: { in: qaOrderIds } },
        });
        await tx.orderAssignmentLog.deleteMany({
          where: { orderId: { in: qaOrderIds } },
        });
        await tx.order.deleteMany({ where: { id: { in: qaOrderIds } } });
      }

      await tx.publicPageComplaint.deleteMany({
        where: { companyId: { in: companyIds } },
      });

      if (captainIds.length > 0) {
        await tx.captainLocation.deleteMany({
          where: { captainId: { in: captainIds } },
        });
        await tx.captain.deleteMany({
          where: { id: { in: captainIds } },
        });
      }

      if (qaCaptainUserIds.length > 0) {
        await tx.captainPushToken.deleteMany({
          where: { userId: { in: qaCaptainUserIds } },
        });
        await tx.user.deleteMany({
          where: {
            id: { in: qaCaptainUserIds },
            role: UserRole.CAPTAIN,
            companyId: { in: companyIds },
          },
        });
      }

      if (wellFormedStores.length > 0) {
        await tx.store.deleteMany({
          where: { id: { in: wellFormedStores.map((s) => s.id) } },
        });
      }

      if (wellFormedBranches.length > 0) {
        await tx.branch.deleteMany({
          where: { id: { in: wellFormedBranches.map((b) => b.id) } },
        });
      }

      if (walletIds.length > 0) {
        await tx.walletAccount.deleteMany({
          where: { id: { in: walletIds } },
        });
      }

      if (qaAdminUserIds.length > 0) {
        await tx.user.deleteMany({
          where: {
            id: { in: qaAdminUserIds },
            role: UserRole.COMPANY_ADMIN,
            companyId: { in: companyIds },
          },
        });
      }

      if (companyIds.length > 0) {
        await tx.deliverySettings.deleteMany({
          where: { companyId: { in: companyIds } },
        });
      }

      if (companyIds.length > 0) {
        await tx.company.deleteMany({
          where: { id: { in: companyIds } },
        });
      }
    },
    { timeout: 240_000 },
  );

  console.error("[qa-stress-cleanup] apply completed.");

  /** Post-verify: no strict QA orders remain */
  const remainingOrders = await prisma.order.count({
    where: { orderNumber: { startsWith: QA_STRESS_ORDER_PREFIX } },
  });
  const remainingCompanies = await prisma.company.count({
    where: { name: { startsWith: "QA-STRESS-Company-" } },
  });
  console.error("[qa-stress-cleanup] post-check qa-stress orders:", remainingOrders, "qa-shaped companies:", remainingCompanies);
}

await main();
