import { UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/errors.js";
import { ordersService } from "./orders.service.js";
import type { AppRole } from "../lib/rbac-roles.js";

export async function getRequestContextByOwnerCode(code: string) {
  const admin = await prisma.user.findFirst({
    where: {
      publicOwnerCode: code,
      role: UserRole.COMPANY_ADMIN,
      isActive: true,
      companyId: { not: null },
    },
    include: {
      company: { select: { id: true, name: true, isActive: true } },
    },
  });
  if (!admin?.companyId || !admin.company?.isActive) {
    throw new AppError(404, "رابط الطلبات غير متاح أو غير مفعّل.", "PUBLIC_OWNER_NOT_FOUND");
  }
  const zones = await prisma.zone.findMany({
    where: { isActive: true, city: { companyId: admin.companyId } },
    orderBy: [{ cityId: "asc" }, { name: "asc" }],
    include: { city: { select: { name: true } } },
  });
  return {
    ownerCode: admin.publicOwnerCode,
    company: { id: admin.company.id, name: admin.company.name },
    companyAdmin: { fullName: admin.fullName },
    zones: zones.map((z) => ({
      id: z.id,
      name: z.name,
      cityName: z.city.name,
    })),
  };
}

export async function createOrderFromPublicPage(body: {
  ownerCode: string;
  storeId?: string;
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  dropoffAddress: string;
  area: string;
  amount: number;
  cashCollection?: number;
  pickupLatitude?: number;
  pickupLongitude?: number;
  dropoffLatitude?: number;
  dropoffLongitude?: number;
  deliveryFee?: number;
  notes?: string;
  distributionMode?: "AUTO" | "MANUAL";
  zoneId?: string;
}) {
  const admin = await prisma.user.findFirst({
    where: {
      publicOwnerCode: body.ownerCode,
      role: UserRole.COMPANY_ADMIN,
      isActive: true,
      companyId: { not: null },
    },
    select: { id: true, companyId: true, branchId: true },
  });
  if (!admin?.companyId) {
    throw new AppError(404, "رابط الطلبات غير متاح أو غير مفعّل.", "PUBLIC_OWNER_NOT_FOUND");
  }

  const actor = {
    userId: admin.id,
    role: "COMPANY_ADMIN" as AppRole,
    storeId: null as string | null,
    companyId: admin.companyId,
    branchId: admin.branchId ?? null,
  };

  return ordersService.create(
    {
      storeId: body.storeId,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      pickupAddress: body.pickupAddress,
      dropoffAddress: body.dropoffAddress,
      area: body.area,
      amount: body.amount,
      cashCollection: body.cashCollection,
      pickupLatitude: body.pickupLatitude,
      pickupLongitude: body.pickupLongitude,
      dropoffLatitude: body.dropoffLatitude,
      dropoffLongitude: body.dropoffLongitude,
      deliveryFee: body.deliveryFee,
      notes: body.notes,
      distributionMode: body.distributionMode,
      zoneId: body.zoneId,
    },
    actor,
  );
}
