import { AssignmentResponseStatus, type Prisma, type OrderStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { normalizePaginationForPrisma } from "../utils/pagination.js";
import { orderStoreInclude, orderStoreListSelect } from "./order-store-enrichment.js";

export const orderRepository = {
  findById(id: string) {
    return prisma.order.findUnique({
      where: { id },
      include: {
        store: orderStoreInclude,
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
        store: orderStoreInclude,
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
        store: orderStoreInclude,
        assignedCaptain: { include: { user: { select: { id: true, fullName: true, phone: true } } } },
        assignmentLogs: { orderBy: { assignedAt: "desc" }, take: 20 },
      },
    });
  },

  list(params: {
    storeId?: string;
    companyId?: string;
    branchId?: string;
    status?: OrderStatus;
    area?: string;
    orderNumber?: string;
    customerPhone?: string;
    page: number;
    pageSize: number;
    /**
     * Read-path: BRANCH_MANAGER / DISPATCHER with supervised stores or captains —
     * restrict to `storeId` in set OR `assignedCaptainId` in set (OR combined).
     */
    supervisorReadOr?: { storeIds: string[]; captainIds: string[] };
  }) {
    const andParts: Prisma.OrderWhereInput[] = [
      /** قوائم التشغيل واللوحة: لا تعرض الطلبات المؤرشفة */
      { archivedAt: null },
    ];
    if (params.storeId) andParts.push({ storeId: params.storeId });
    if (params.companyId) andParts.push({ companyId: params.companyId });
    if (params.branchId) andParts.push({ branchId: params.branchId });
    if (params.status) andParts.push({ status: params.status });
    if (params.area) andParts.push({ area: { contains: params.area, mode: "insensitive" } });
    if (params.orderNumber) andParts.push({ orderNumber: { contains: params.orderNumber, mode: "insensitive" } });
    if (params.customerPhone) andParts.push({ customerPhone: { contains: params.customerPhone } });

    if (params.supervisorReadOr) {
      const { storeIds, captainIds } = params.supervisorReadOr;
      const or: Prisma.OrderWhereInput[] = [];
      if (storeIds.length > 0) or.push({ storeId: { in: storeIds } });
      if (captainIds.length > 0) or.push({ assignedCaptainId: { in: captainIds } });
      if (or.length > 0) andParts.push({ OR: or });
    }

    const where: Prisma.OrderWhereInput = andParts.length === 1 ? andParts[0]! : { AND: andParts };

    const { skip, take } = normalizePaginationForPrisma(params);

    return prisma.$transaction([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: {
          store: { select: orderStoreListSelect },
          assignedCaptain: {
            include: { user: { select: { fullName: true, phone: true } } },
          },
          /** للوحة التوزيع: مهلة قبول العرض الحالي (PENDING لنفس الكابتن المعيّن) */
          assignmentLogs: {
            where: { responseStatus: AssignmentResponseStatus.PENDING },
            orderBy: { assignedAt: "desc" },
            take: 5,
            select: {
              captainId: true,
              assignedAt: true,
              expiredAt: true,
              responseStatus: true,
            },
          },
        },
      }),
    ]);
  },

  /** سجل طلبات العميل — يشمل المؤرشفة للمراجعة الشخصية */
  listForCustomerAccount(params: { customerUserId: string; page: number; pageSize: number }) {
    const where: Prisma.OrderWhereInput = { customerUserId: params.customerUserId };
    const { skip, take } = normalizePaginationForPrisma(params);
    return prisma.$transaction([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: {
          store: { select: orderStoreListSelect },
          assignedCaptain: {
            include: { user: { select: { fullName: true, phone: true } } },
          },
          assignmentLogs: {
            where: { responseStatus: AssignmentResponseStatus.PENDING },
            orderBy: { assignedAt: "desc" },
            take: 5,
            select: {
              captainId: true,
              assignedAt: true,
              expiredAt: true,
              responseStatus: true,
            },
          },
        },
      }),
    ]);
  },

  listForCaptain(params: {
    captainId: string;
    branchId: string;
    status?: OrderStatus;
    from?: Date;
    to?: Date;
    area?: string;
    q?: string;
    page: number;
    pageSize: number;
  }) {
    const AND: Prisma.OrderWhereInput[] = [
      { branchId: params.branchId },
      {
        OR: [
          { assignedCaptainId: params.captainId },
          { assignmentLogs: { some: { captainId: params.captainId } } },
        ],
      },
    ];
    if (params.status) AND.push({ status: params.status });
    if (params.from || params.to) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (params.from) createdAt.gte = params.from;
      if (params.to) createdAt.lte = params.to;
      AND.push({ createdAt });
    }
    const areaTrim = params.area?.trim();
    if (areaTrim) AND.push({ area: { contains: areaTrim, mode: "insensitive" } });
    const qTrim = params.q?.trim();
    if (qTrim) {
      AND.push({
        OR: [
          { orderNumber: { contains: qTrim, mode: "insensitive" } },
          { customerName: { contains: qTrim, mode: "insensitive" } },
          { customerPhone: { contains: qTrim, mode: "insensitive" } },
          { pickupAddress: { contains: qTrim, mode: "insensitive" } },
          { dropoffAddress: { contains: qTrim, mode: "insensitive" } },
          { area: { contains: qTrim, mode: "insensitive" } },
        ],
      });
    }

    const where: Prisma.OrderWhereInput = { AND };

    const { skip, take } = normalizePaginationForPrisma(params);

    return prisma.$transaction([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: {
          store: { select: orderStoreListSelect },
          assignedCaptain: {
            include: { user: { select: { id: true, fullName: true, phone: true } } },
          },
        },
      }),
    ]);
  },
};
