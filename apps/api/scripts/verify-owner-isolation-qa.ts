/**
 * One-off QA: Ahmad/Mahmoud company-admin isolation + public API smoke.
 * Run: cd apps/api && npx tsx scripts/verify-owner-isolation-qa.ts
 * Requires DATABASE_URL; uses bcrypt for passwords.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

const ZONE_NAME = "القدس";
const PASS = "VerifyIso123!";
const AHMAD_PHONE = "+966501110001";
const MAHMOUD_PHONE = "+966501110002";
const CAP_A_PHONE = "+966501110011";
const CAP_B_PHONE = "+966501110012";
const CODE_A = "CA-AHMAD";
const CODE_B = "CA-MAHMOUD";

async function ensureCompanyWithZone(name: string) {
  let company = await prisma.company.findFirst({ where: { name } });
  if (!company) {
    company = await prisma.company.create({
      data: { name },
    });
  }
  let city = await prisma.city.findFirst({ where: { companyId: company.id, name: "مدينة تجريبية" } });
  if (!city) {
    city = await prisma.city.create({
      data: { companyId: company.id, name: "مدينة تجريبية", isActive: true },
    });
  }
  let zone = await prisma.zone.findFirst({
    where: { cityId: city.id, name: ZONE_NAME, isActive: true },
  });
  if (!zone) {
    zone = await prisma.zone.create({
      data: { cityId: city.id, name: ZONE_NAME, isActive: true },
    });
  }
  let branch = await prisma.branch.findFirst({
    where: { companyId: company.id, isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        companyId: company.id,
        name: "فرع رئيسي",
        isActive: true,
        cityId: city.id,
        zoneId: zone.id,
      },
    });
  }
  return { company, city, zone, branch };
}

async function upsertCompanyAdmin(
  phone: string,
  fullName: string,
  companyId: string,
  publicOwnerCode: string,
) {
  const passwordHash = await bcrypt.hash(PASS, 10);
  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        fullName,
        companyId,
        role: UserRole.COMPANY_ADMIN,
        publicOwnerCode,
        passwordHash,
        isActive: true,
        branchId: null,
      },
    });
    return prisma.user.findUniqueOrThrow({ where: { id: existing.id } });
  }
  return prisma.user.create({
    data: {
      phone,
      fullName,
      companyId,
      role: UserRole.COMPANY_ADMIN,
      publicOwnerCode,
      passwordHash,
      isActive: true,
    },
  });
}

async function upsertCaptain(
  phone: string,
  fullName: string,
  companyId: string,
  branchId: string,
  zoneId: string,
  createdByUserId: string,
) {
  const passwordHash = await bcrypt.hash(PASS, 10);
  let user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        phone,
        fullName,
        role: UserRole.CAPTAIN,
        passwordHash,
        isActive: true,
      },
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { fullName, passwordHash, isActive: true, role: UserRole.CAPTAIN },
    });
  }
  await prisma.captain.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      companyId,
      branchId,
      vehicleType: "دراجة",
      area: ZONE_NAME,
      isActive: true,
      zoneId,
      createdByUserId,
    },
    update: {
      companyId,
      branchId,
      zoneId,
      createdByUserId,
      isActive: true,
    },
  });
  return user;
}

async function main() {
  const a = await ensureCompanyWithZone("Ahmad Company QA");
  const b = await ensureCompanyWithZone("Mahmoud Company QA");

  const adminA = await upsertCompanyAdmin(AHMAD_PHONE, "Ahmad Admin QA", a.company.id, CODE_A);
  const adminB = await upsertCompanyAdmin(MAHMOUD_PHONE, "Mahmoud Admin QA", b.company.id, CODE_B);

  await upsertCaptain(CAP_A_PHONE, "Captain A1", a.company.id, a.branch.id, a.zone.id, adminA.id);
  await upsertCaptain(CAP_B_PHONE, "Captain B1", b.company.id, b.branch.id, b.zone.id, adminB.id);

  const capAUser = await prisma.user.findUniqueOrThrow({ where: { phone: CAP_A_PHONE } });
  const capBUser = await prisma.user.findUniqueOrThrow({ where: { phone: CAP_B_PHONE } });
  const capA = await prisma.captain.findUniqueOrThrow({ where: { userId: capAUser.id } });
  const capB = await prisma.captain.findUniqueOrThrow({ where: { userId: capBUser.id } });

  console.log(
    JSON.stringify(
      {
        adminA: { id: adminA.id, companyId: a.company.id, code: CODE_A },
        adminB: { id: adminB.id, companyId: b.company.id, code: CODE_B },
        zoneA: a.zone.id,
        zoneB: b.zone.id,
        captainA: { userId: capAUser.id, captainId: capA.id },
        captainB: { userId: capBUser.id, captainId: capB.id },
        password: PASS,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
