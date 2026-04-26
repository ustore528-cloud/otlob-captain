/**
 * Service-level checks for captain create tenant scope (no HTTP).
 * Negative cases do not persist. Success case creates then deletes captain + user.
 * Creates a throwaway Company+City+Zone+Branch for cross-tenant fixtures, then deletes it.
 *
 * Run: `npm run verify:captain-create-scope` from `apps/api`
 */
import "dotenv/config";
import { UserRole } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";
import { captainsService } from "../src/services/captains.service.js";
import { AppError } from "../src/utils/errors.js";

function assertAppError(e: unknown, code: string): void {
  if (!(e instanceof AppError) || e.code !== code) {
    // eslint-disable-next-line no-console
    console.error("expected", code, "got", e);
    throw e instanceof Error ? e : new Error(String(e));
  }
}

function body(phone: string) {
  return {
    fullName: "Verify Captain Scope",
    phone,
    password: "TestPass1!",
    vehicleType: "سيارة" as const,
    area: "Scope QA",
  };
}

async function main() {
  const log: string[] = [];
  const stamp = Date.now();
  const fx = await prisma.$transaction(async (tx) => {
    const co = await tx.company.create({
      data: { name: `verify-captain-scope-${stamp}`, isActive: true },
    });
    const city = await tx.city.create({
      data: { name: `verify-city-${stamp}`, companyId: co.id, isActive: true },
    });
    const zone = await tx.zone.create({
      data: { name: `verify-zone-${stamp}`, cityId: city.id, isActive: true },
    });
    const br = await tx.branch.create({
      data: { name: `verify-branch-${stamp}`, companyId: co.id, isActive: true },
    });
    return { companyId: co.id, cityId: city.id, zoneId: zone.id, branchId: br.id };
  });

  try {
    const superUser = await prisma.user.findFirst({
      where: { role: UserRole.SUPER_ADMIN, isActive: true },
      select: { id: true },
    });
    if (!superUser) throw new Error("Fixture missing: active SUPER_ADMIN user");

    const companyAdmin = await prisma.user.findFirst({
      where: { role: UserRole.COMPANY_ADMIN, isActive: true, companyId: { not: null } },
      select: { id: true, companyId: true },
    });
    if (!companyAdmin?.companyId) throw new Error("Fixture missing: COMPANY_ADMIN with companyId");

    const branchManager = await prisma.user.findFirst({
      where: {
        role: UserRole.BRANCH_MANAGER,
        isActive: true,
        companyId: companyAdmin.companyId,
        branchId: { not: null },
      },
      select: { id: true, companyId: true, branchId: true },
    });
    if (!branchManager?.branchId) {
      throw new Error("Fixture missing: BRANCH_MANAGER with branch in same company as COMPANY_ADMIN");
    }

    const foreignBranchId = fx.branchId;
    const wrongZoneId = fx.zoneId;

    const homeBranch = await prisma.branch.findFirst({
      where: { isActive: true, companyId: companyAdmin.companyId },
      select: { id: true },
    });
    if (!homeBranch) throw new Error("Fixture missing: branch in COMPANY_ADMIN company");

    const otherBranchSameCompany = await prisma.branch.findFirst({
      where: {
        isActive: true,
        companyId: companyAdmin.companyId,
        id: { not: branchManager.branchId },
      },
      select: { id: true },
    });

    // COMPANY_ADMIN + foreign branch
    try {
      await captainsService.create({ ...body(`+9665${Date.now()}v1`), branchId: foreignBranchId }, companyAdmin.id);
      throw new Error("expected COMPANY_ADMIN + foreign branch to fail");
    } catch (e) {
      assertAppError(e, "INVALID_BRANCH");
      log.push("PASS: COMPANY_ADMIN cannot use branchId from another company (INVALID_BRANCH)");
    }

    // COMPANY_ADMIN + foreign zone
    try {
      await captainsService.create(
        { ...body(`+9665${Date.now()}v2`), branchId: homeBranch.id, zoneId: wrongZoneId },
        companyAdmin.id,
      );
      throw new Error("expected COMPANY_ADMIN + foreign zone to fail");
    } catch (e) {
      assertAppError(e, "INVALID_ZONE");
      log.push("PASS: COMPANY_ADMIN cannot use zoneId from another company (INVALID_ZONE)");
    }

    // COMPANY_ADMIN + companyId in body (forbidden)
    try {
      await captainsService.create(
        { ...body(`+9665${Date.now()}v3`), companyId: companyAdmin.companyId ?? undefined, branchId: homeBranch.id },
        companyAdmin.id,
      );
      throw new Error("expected COMPANY_ADMIN + companyId to fail");
    } catch (e) {
      assertAppError(e, "COMPANY_ID_NOT_ALLOWED");
      log.push("PASS: COMPANY_ADMIN cannot send companyId (COMPANY_ID_NOT_ALLOWED)");
    }

    // BRANCH_MANAGER + another branch
    const bmWrongBranchId = otherBranchSameCompany?.id ?? foreignBranchId;
    if (bmWrongBranchId === branchManager.branchId) {
      throw new Error("Fixture conflict: no distinct wrong branch for BRANCH_MANAGER test");
    }
    try {
      await captainsService.create({ ...body(`+9665${Date.now()}v4`), branchId: bmWrongBranchId }, branchManager.id);
      throw new Error("expected BRANCH_MANAGER wrong branch to fail");
    } catch (e) {
      assertAppError(e, "FORBIDDEN");
      log.push("PASS: BRANCH_MANAGER cannot create captain in another branch (FORBIDDEN)");
    }

    // SUPER_ADMIN missing companyId
    try {
      await captainsService.create({ ...body(`+9665${Date.now()}v5`) }, superUser.id);
      throw new Error("expected SUPER_ADMIN without companyId to fail");
    } catch (e) {
      assertAppError(e, "COMPANY_ID_REQUIRED");
      log.push("PASS: SUPER_ADMIN requires companyId (COMPANY_ID_REQUIRED)");
    }

    // SUPER_ADMIN mismatched companyId + branchId
    try {
      await captainsService.create(
        { ...body(`+9665${Date.now()}v6`), companyId: companyAdmin.companyId, branchId: foreignBranchId },
        superUser.id,
      );
      throw new Error("expected SUPER_ADMIN company/branch mismatch to fail");
    } catch (e) {
      assertAppError(e, "INVALID_BRANCH_FOR_COMPANY");
      log.push("PASS: SUPER_ADMIN cannot mix companyId with foreign branchId (INVALID_BRANCH_FOR_COMPANY)");
    }

    // SUPER_ADMIN mismatched companyId + zoneId
    try {
      await captainsService.create(
        {
          ...body(`+9665${Date.now()}v7`),
          companyId: companyAdmin.companyId,
          branchId: homeBranch.id,
          zoneId: wrongZoneId,
        },
        superUser.id,
      );
      throw new Error("expected SUPER_ADMIN company/zone mismatch to fail");
    } catch (e) {
      assertAppError(e, "INVALID_ZONE");
      log.push("PASS: SUPER_ADMIN cannot mix companyId with foreign zoneId (INVALID_ZONE)");
    }

    // SUPER_ADMIN success: aligned company + branch (+ optional zone from same company)
    const okZone = await prisma.zone.findFirst({
      where: { isActive: true, city: { companyId: companyAdmin.companyId } },
      select: { id: true },
    });

    const okPhone = `+9665${Date.now()}v8`;
    await captainsService.create(
      {
        ...body(okPhone),
        companyId: companyAdmin.companyId,
        branchId: homeBranch.id,
        ...(okZone ? { zoneId: okZone.id } : {}),
      },
      superUser.id,
    );
    log.push("PASS: SUPER_ADMIN create with matching companyId, branchId" + (okZone ? ", zoneId" : ""));

    const createdUser = await prisma.user.findFirst({
      where: { phone: okPhone },
      include: { captain: true },
    });
    if (!createdUser?.captain) throw new Error("success path did not persist captain");
    await prisma.captain.delete({ where: { id: createdUser.captain.id } });
    await prisma.user.delete({ where: { id: createdUser.id } });
    log.push("CLEANUP: removed temporary captain + user from success path");

    // eslint-disable-next-line no-console
    console.log(log.join("\n"));
  } finally {
    await prisma.branch.delete({ where: { id: fx.branchId } }).catch(() => {});
    await prisma.zone.delete({ where: { id: fx.zoneId } }).catch(() => {});
    await prisma.city.delete({ where: { id: fx.cityId } }).catch(() => {});
    await prisma.company.delete({ where: { id: fx.companyId } }).catch(() => {});
  }
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
