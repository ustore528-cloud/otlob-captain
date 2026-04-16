import { PrismaClient, $Enums } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/** معرف ثابت للمتجر في الـ seed — `Store.id` هو المفتاح الفريد الوحيد المناسب لـ upsert على هذا الموديل. */
const SEED_STORE_ID = "seed-store-main";

async function main() {
  const passwordHash = await bcrypt.hash("Admin12345!", 12);

  await prisma.user.upsert({
    where: { phone: "+966500000001" },
    update: {},
    create: {
      fullName: "مسؤول النظام",
      phone: "+966500000001",
      email: "admin@example.com",
      passwordHash,
      role: $Enums.UserRole.ADMIN,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { phone: "+966500000002" },
    update: {},
    create: {
      fullName: "موزّع تجريبي",
      phone: "+966500000002",
      email: "dispatch@example.com",
      passwordHash,
      role: $Enums.UserRole.DISPATCHER,
      isActive: true,
    },
  });

  const storeOwner = await prisma.user.upsert({
    where: { phone: "+966500000003" },
    update: {},
    create: {
      fullName: "صاحب متجر تجريبي",
      phone: "+966500000003",
      email: "store@example.com",
      passwordHash,
      role: $Enums.UserRole.STORE,
      isActive: true,
    },
  });

  await prisma.store.upsert({
    where: { id: SEED_STORE_ID },
    update: {},
    create: {
      id: SEED_STORE_ID,
      name: "متجر تجريبي",
      phone: "+966500000004",
      area: "الرياض — الشمال",
      address: "طريق الملك فهد، مبنى تجريبي",
      isActive: true,
      ownerUserId: storeOwner.id,
    },
  });

  const captainUser = await prisma.user.upsert({
    where: { phone: "+966511111111" },
    update: {},
    create: {
      fullName: "كابتن تجريبي",
      phone: "+966511111111",
      email: "captain@example.com",
      passwordHash,
      role: $Enums.UserRole.CAPTAIN,
      isActive: true,
    },
  });

  await prisma.captain.upsert({
    where: { userId: captainUser.id },
    update: {},
    create: {
      userId: captainUser.id,
      vehicleType: "motorcycle",
      area: "الرياض",
      isActive: true,
      availabilityStatus: $Enums.CaptainAvailabilityStatus.AVAILABLE,
    },
  });

  // eslint-disable-next-line no-console
  console.log(
    "Seed OK: users (ADMIN, DISPATCHER, STORE, CAPTAIN), store, captain profile",
  );
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
