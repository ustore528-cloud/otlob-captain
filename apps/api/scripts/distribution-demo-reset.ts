/**
 * تجربة التوزيع:
 * - حذف الطلبات، 3 كباتن + مواقع على الخريطة
 * - طلب واحد عبر ordersService.create (نفس مسار لوحة التحكم)
 * - إعادة إرسال للتوزيع عبر resendToDistribution (نفس زر «إعادة الإرسال» — بدون محاكاة داخلية)
 * - لا قبول من السكربت — المهلة الحقيقية / الرفض من الموبايل
 *
 * تشغيل: من apps/api — npm run db:demo-reset
 */
import "dotenv/config";
import { UserRole, $Enums } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma.js";
import { distributionService } from "../src/services/distribution/index.js";
import { ordersService } from "../src/services/orders.service.js";

const VEHICLE_TYPES = ["بسكليت", "دراجه ناريه", "سيارة", "شحن نقل"] as const;

const MAP_CENTER_LAT = 24.7136;
const MAP_CENTER_LNG = 46.6753;
const DEMO_LOCATION_RADIUS = 0.052;

const DEMO_CAPTAIN_COUNT = 3;

async function main() {
  const defaultBranch = await prisma.branch.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (!defaultBranch) {
    throw new Error("No active branch — run migrations + seed first.");
  }

  const deleted = await prisma.order.deleteMany({});
  // eslint-disable-next-line no-console
  console.log(`Deleted orders: ${deleted.count}`);

  const passwordHash = await bcrypt.hash("Captain123!", 12);

  const newCaptainPhones = Array.from({ length: DEMO_CAPTAIN_COUNT }, (_, i) => {
    const n = String(501 + i).padStart(3, "0");
    return `+96651200${n}`;
  });

  await prisma.captain.updateMany({
    where: {
      user: { phone: { notIn: newCaptainPhones } },
    },
    data: {
      isActive: false,
      availabilityStatus: $Enums.CaptainAvailabilityStatus.OFFLINE,
    },
  });

  for (let i = 0; i < newCaptainPhones.length; i++) {
    const phone = newCaptainPhones[i];
    const user = await prisma.user.upsert({
      where: { phone },
      update: { isActive: true },
      create: {
        fullName: `كابتن توزيع ${String(i + 1).padStart(2, "0")}`,
        phone,
        email: `captain-demo-${i + 1}@example.local`,
        passwordHash,
        role: $Enums.UserRole.CAPTAIN,
        isActive: true,
      },
    });

    await prisma.captain.upsert({
      where: { userId: user.id },
      update: {
        companyId: defaultBranch.companyId,
        branchId: defaultBranch.id,
        isActive: true,
        availabilityStatus: $Enums.CaptainAvailabilityStatus.AVAILABLE,
        vehicleType: VEHICLE_TYPES[i % VEHICLE_TYPES.length],
        area: "الرياض",
      },
      create: {
        userId: user.id,
        companyId: defaultBranch.companyId,
        branchId: defaultBranch.id,
        vehicleType: VEHICLE_TYPES[i % VEHICLE_TYPES.length],
        area: "الرياض",
        isActive: true,
        availabilityStatus: $Enums.CaptainAvailabilityStatus.AVAILABLE,
      },
    });
  }

  const last = newCaptainPhones[newCaptainPhones.length - 1];
  // eslint-disable-next-line no-console
  console.log(
    `تفعيل ${DEMO_CAPTAIN_COUNT} كابتن فقط (${newCaptainPhones[0]} … ${last}).`,
  );

  const demoCaptainRows = await prisma.captain.findMany({
    where: { user: { phone: { in: newCaptainPhones } } },
    select: { id: true, user: { select: { phone: true } } },
  });
  const captainByPhone = new Map(demoCaptainRows.map((r) => [r.user.phone, r.id]));

  await prisma.captainLocation.deleteMany({
    where: { captainId: { in: demoCaptainRows.map((r) => r.id) } },
  });

  for (let i = 0; i < newCaptainPhones.length; i++) {
    const phone = newCaptainPhones[i];
    const captainId = captainByPhone.get(phone);
    if (!captainId) continue;
    const angle = (2 * Math.PI * i) / DEMO_CAPTAIN_COUNT;
    const latitude = MAP_CENTER_LAT + DEMO_LOCATION_RADIUS * Math.sin(angle);
    const longitude = MAP_CENTER_LNG + DEMO_LOCATION_RADIUS * Math.cos(angle);
    await prisma.captainLocation.create({
      data: { captainId, latitude, longitude },
    });
  }

  const store =
    (await prisma.store.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" } })) ??
    (() => {
      throw new Error("No active store — run prisma seed or create a store first.");
    })();

  const actor = await prisma.user.findFirst({
    where: { role: UserRole.COMPANY_ADMIN, isActive: true },
    select: { id: true, role: true, companyId: true, branchId: true },
  });
  if (!actor) {
    throw new Error("لا يوجد مستخدم COMPANY_ADMIN نشط — شغّل prisma seed أو أنشئ مسؤولاً.");
  }

  const order = await ordersService.create(
    {
      storeId: store.id,
      customerName: "عميل تجربة دوران",
      customerPhone: "+966501111001",
      pickupAddress: "استلام — الرياض",
      dropoffAddress: "تسليم — الرياض",
      area: "الرياض",
      amount: 50,
      cashCollection: 0,
      notes: "[demo] توزيع — القبول/الرفض من الموبايل أو انتهاء المهلة",
      distributionMode: "AUTO",
      dropoffLatitude: MAP_CENTER_LAT,
      dropoffLongitude: MAP_CENTER_LNG,
    },
    {
      userId: actor.id,
      role: actor.role,
      storeId: null,
      companyId: actor.companyId ?? null,
      branchId: actor.branchId ?? null,
    },
  );

  // eslint-disable-next-line no-console
  console.log(`طلب جديد: ${order.orderNumber}`);

  await distributionService.resendToDistribution(order.id, actor.id, {}, {
    userId: actor.id,
    role: actor.role,
    companyId: actor.companyId ?? null,
    branchId: actor.branchId ?? null,
  });

  const after = await prisma.order.findUnique({
    where: { id: order.id },
    select: {
      status: true,
      assignedCaptain: { select: { user: { select: { fullName: true } } } },
    },
  });
  // eslint-disable-next-line no-console
  console.log(
    `إعادة إرسال للتوزيع (كزر لوحة التحكم) → ${after?.status} — عرض على: «${after?.assignedCaptain?.user.fullName ?? "—"}»`,
  );
  // eslint-disable-next-line no-console
  console.log(
    "لا قبول من السكربت. التالي: رفض/انتظار المهلة من الـ API كالعادة، ثم يمكن الضغط «إعادة الإرسال» من الواجهة إن رغبت.",
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
