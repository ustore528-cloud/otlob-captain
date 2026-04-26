/**
 * Service-level checks for read-only finance APIs (Slice A).
 * Run: `npm run verify:wallet-read` from `apps/api`
 */
import "dotenv/config";
import { UserRole, WalletOwnerType } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";
import { AppError } from "../src/utils/errors.js";
import { walletReadService } from "../src/services/wallet-read.service.js";

async function main() {
  const staff =
    (await prisma.user.findFirst({ where: { role: UserRole.SUPER_ADMIN, isActive: true } })) ??
    (await prisma.user.findFirst({ where: { role: UserRole.COMPANY_ADMIN, isActive: true, companyId: { not: null } } }));
  const store = await prisma.store.findFirst();
  if (!staff || !store) {
    throw new Error("Need at least one staff user (SUPER_ADMIN or scoped COMPANY_ADMIN) and one store (run seed).");
  }

  const b = await walletReadService.getStoreBalance(store.id, {
    userId: staff.id,
    role: staff.role as "SUPER_ADMIN" | "COMPANY_ADMIN",
    companyId: staff.companyId ?? null,
    branchId: staff.branchId ?? null,
  });
  if (b.ownerType !== WalletOwnerType.STORE || b.ownerId !== store.id) {
    throw new Error("Store wallet DTO mismatch");
  }

  const fakeStoreId = "cm0000000000000000000000000";
  try {
    await walletReadService.getStoreBalance(fakeStoreId, {
      userId: staff.id,
      role: "SUPER_ADMIN",
      companyId: null,
      branchId: null,
    });
    throw new Error("expected 404 for missing store");
  } catch (e) {
    if (!(e instanceof AppError) || e.code !== "NOT_FOUND") {
      throw e;
    }
  }

  // eslint-disable-next-line no-console
  console.info("[verify-wallet-read] passed");
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
