import type { Prisma, OrderStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export const orderRepository = {
  findById(id: string) {
    return prisma.order.findUnique({
      where: { id },
      include: {
        store: true,
        assignedCaptain: { include: { user: { select: { id: true, fullName: true, phone: true } } } },
        assignmentLogs: { orderBy: { assignedAt: "desc" }, take: 50 },
        createdBy: { select: { id: true, fullName: true, phone: true } },
      },
    });
  },

  create(data: Prisma.OrderCreateInput) {
    return prisma.order.create({
      data,
      include: {
        store: true,
        assignedCaptain: true,
        createdBy: { select: { id: true, fullName: true, phone: true } },
      },
    });
  },

  update(id: string, data: Prisma.OrderUpdateInput) {
    return prisma.order.update({
      where: { id },
      data,
      include: {
        store: true,
        assignedCaptain: { include: { user: { select: { id: true, fullName: true, phone: true } } } },
        assignmentLogs: { orderBy: { assignedAt: "desc" }, take: 20 },
      },
    });
  },

  list(params: {
    storeId?: string;
    status?: OrderStatus;
    area?: string;
    orderNumber?: string;
    customerPhone?: string;
    page: number;
    pageSize: number;
  }) {
    const where: Prisma.OrderWhereInput = {};
    if (params.storeId) where.storeId = params.storeId;
    if (params.status) where.status = params.status;
    if (params.area) where.area = { contains: params.area, mode: "insensitive" };
    if (params.orderNumber) where.orderNumber = { contains: params.orderNumber, mode: "insensitive" };
    if (params.customerPhone) where.customerPhone = { contains: params.customerPhone };

    return prisma.$transaction([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        include: {
          store: { select: { id: true, name: true, area: true } },
          assignedCaptain: {
            include: { user: { select: { fullName: true, phone: true } } },
          },
        },
      }),
    ]);
  },

  listForCaptain(params: {
    captainId: string;
    status?: OrderStatus;
    from?: Date;
    to?: Date;
    page: number;
    pageSize: number;
  }) {
    const where: Prisma.OrderWhereInput = {
      OR: [{ assignedCaptainId: params.captainId }, { assignmentLogs: { some: { captainId: params.captainId } } }],
    };
    if (params.status) where.status = params.status;
    if (params.from || params.to) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (params.from) createdAt.gte = params.from;
      if (params.to) createdAt.lte = params.to;
      where.createdAt = createdAt;
    }

    return prisma.$transaction([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        include: {
          store: { select: { id: true, name: true, area: true } },
        },
      }),
    ]);
  },
};
