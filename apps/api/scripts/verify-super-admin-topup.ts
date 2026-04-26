/**
 * Service-level checks for super-admin top-up (Slice 3). Requires DB + migrations.
 * Run: `npm run verify:super-admin-topup` from `apps/api`
 */
import "dotenv/config";
import { UserRole } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";
import { superAdminWalletTopupService } from "../src/services/super-admin-wallet-topup.service.js";
import { AppError } from "../src/utils/errors.js";

function assertAppError(e: unknown, code: string): void {
  if (!(e instanceof AppError) || e.code !== code) {
    throw e instanceof Error ? e : new Error(String(e));
  }
}

async function main() {
  const company =
    (await prisma.company.findFirst()) ??
    (await prisma.company.create({ data: { name: "sa-topup-verify" } }));

  const branch = await prisma.branch.findFirst({ where: { companyId: company.id } });
  if (!branch) {
    throw new Error("No branch for company — run seed/migrations with branches.");
  }

  const store = await prisma.store.findFirst({ where: { companyId: company.id } });
  if (!store) {
    throw new Error("No store for company — run seed or create a store first.");
  }

  const bm =
    (await prisma.user.findFirst({ where: { companyId: company.id, role: UserRole.BRANCH_MANAGER, isActive: true } })) ??
    (await prisma.user.create({
      data: {
        fullName: "SA Topup Verify BM",
        phone: `+9665${String(Date.now()).slice(-8)}`,
        passwordHash: "x",
        role: UserRole.BRANCH_MANAGER,
        companyId: company.id,
        branchId: branch.id,
        isActive: true,
      },
    }));

  const actor = bm;

  const keyStore = `verify-sa-store-${Date.now()}`;
  const a1 = await superAdminWalletTopupService.topUpStoreWallet({
    storeId: store.id,
    amount: "20.00",
    idempotencyKey: keyStore,
    createdByUserId: actor.id,
  });
  if (a1.idempotent) {
    throw new Error("first store top-up should not be idempotent");
  }
  const a2 = await superAdminWalletTopupService.topUpStoreWallet({
    storeId: store.id,
    amount: "20.00",
    idempotencyKey: keyStore,
    createdByUserId: actor.id,
  });
  if (!a2.idempotent || a1.ledgerEntryId !== a2.ledgerEntryId) {
    throw new Error("store idempotent replay mismatch");
  }

  const keySup = `verify-sa-sup-${Date.now()}`;
  const s1 = await superAdminWalletTopupService.topUpSupervisorUserWallet({
    userId: bm.id,
    amount: 5.5,
    idempotencyKey: keySup,
    createdByUserId: actor.id,
  });
  if (s1.idempotent) {
    throw new Error("first supervisor top-up should not be idempotent");
  }
  const s2 = await superAdminWalletTopupService.topUpSupervisorUserWallet({
    userId: bm.id,
    amount: 5.5,
    idempotencyKey: keySup,
    createdByUserId: actor.id,
  });
  if (!s2.idempotent) {
    throw new Error("second supervisor top-up with same idempotency should be idempotent");
  }

  const captain = await prisma.user.findFirst({ where: { companyId: company.id, role: UserRole.CAPTAIN, isActive: true } });
  if (captain) {
    try {
      await superAdminWalletTopupService.topUpSupervisorUserWallet({
        userId: captain.id,
        amount: "1.00",
        idempotencyKey: `x-${Date.now()}`,
        createdByUserId: actor.id,
      });
      throw new Error("expected CAPTAIN top-up to throw");
    } catch (e) {
      assertAppError(e, "SUPERVISOR_TOPUP_ROLE_FORBIDDEN");
    }
  } else {
    // eslint-disable-next-line no-console
    console.warn("[verify-super-admin-topup] skip CAPTAIN rejection: no captain user in company");
  }

  // eslint-disable-next-line no-console
  console.info("[verify-super-admin-topup] passed");
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
