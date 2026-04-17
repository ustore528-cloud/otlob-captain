import type { Prisma, UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

const userPublicSelect = {
  id: true,
  fullName: true,
  phone: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  customerPickupAddress: true,
  customerDropoffAddress: true,
  customerLocationLink: true,
  customerArea: true,
  customerDropoffLat: true,
  customerDropoffLng: true,
  customerPreferredAmount: true,
  customerPreferredDelivery: true,
} satisfies Prisma.UserSelect;

export const userRepository = {
  findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  findByPhone(phone: string) {
    return prisma.user.findUnique({ where: { phone } });
  },

  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },

  list(params: { role?: UserRole; page: number; pageSize: number }) {
    const where: Prisma.UserWhereInput = {};
    if (params.role) where.role = params.role;
    return prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        select: userPublicSelect,
      }),
    ]);
  },

  updateActive(id: string, isActive: boolean) {
    return prisma.user.update({
      where: { id },
      data: { isActive },
      select: userPublicSelect,
    });
  },

  updateCustomerProfile(id: string, data: Prisma.UserUpdateInput) {
    return prisma.user.update({
      where: { id },
      data,
      select: userPublicSelect,
    });
  },

  create(data: Prisma.UserCreateInput) {
    return prisma.user.create({ data });
  },

  async primaryStoreIdForOwner(userId: string): Promise<string | null> {
    const s = await prisma.store.findFirst({
      where: { ownerUserId: userId, isActive: true },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    return s?.id ?? null;
  },
};
