import { AssignmentResponseStatus, Prisma, type OrderStatus } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { prisma } from "../lib/prisma.js";
import { normalizePaginationForPrisma } from "../utils/pagination.js";
import { orderStoreInclude, orderStoreListSelect } from "./order-store-enrichment.js";
import { AppError } from "../utils/errors.js";

type StoreConnectEnvelope = { connect?: { id?: string } };

function getConnectedStoreId(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const maybeStore = (data as { store?: StoreConnectEnvelope }).store;
  const id = maybeStore?.connect?.id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function hasDirectTenantOverride(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const payload = data as { company?: unknown; branch?: unknown; companyId?: unknown; branchId?: unknown };
  return (
    payload.company !== undefined ||
    payload.branch !== undefined ||
    payload.companyId !== undefined ||
    payload.branchId !== undefined
  );
}

async function deriveTenantFromConnectedStore<T extends Prisma.OrderCreateInput | Prisma.OrderUpdateInput>(
  data: T,
): Promise<T> {
  const storeId = getConnectedStoreId(data);
  if (!storeId) return data;
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { id: true, isActive: true, companyId: true, branchId: true },
  });
  if (!store || !store.isActive) {
    throw new AppError(400, "Store not found or inactive", "BAD_REQUEST");
  }
  return {
    ...data,
    company: { connect: { id: store.companyId } },
    branch: { connect: { id: store.branchId } },
  } as T;
}

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

  async create(data: Prisma.OrderCreateInput) {
    const normalizedData = await deriveTenantFromConnectedStore(data);
    return prisma.order.create({
      data: normalizedData,
      include: {
        store: orderStoreInclude,
        assignedCaptain: true,
        createdBy: { select: { id: true, fullName: true, phone: true } },
      },
    });
  },

  /**
   * Assigns next per-company display sequence with optimistic retry.
   * Uniqueness is enforced by DB unique index on `(company_id, display_order_no)`.
   */
  async createWithDisplaySequence(data: Prisma.OrderCreateInput, companyIdForSequence: string) {
    const normalizedData = await deriveTenantFromConnectedStore(data);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const agg = await prisma.order.aggregate({
        where: { companyId: companyIdForSequence },
        _max: { displayOrderNo: true },
      });
      const next = (agg._max.displayOrderNo ?? 0) + 1;
      const withSeq = { ...normalizedData, displayOrderNo: next } as Prisma.OrderCreateInput;
      try {
        return await prisma.order.create({
          data: withSeq,
          include: {
            store: orderStoreInclude,
            assignedCaptain: true,
            createdBy: { select: { id: true, fullName: true, phone: true } },
          },
        });
      } catch (e) {
        if (
          e instanceof PrismaClientKnownRequestError &&
          e.code === "P2002" &&
          String((e.meta as { target?: unknown } | undefined)?.target ?? "").includes("display_order_no")
        ) {
          continue;
        }
        throw e;
      }
    }
    throw new AppError(500, "Could not allocate display order number.", "INTERNAL");
  },

  async update(id: string, data: Prisma.OrderUpdateInput) {
    const hasStoreConnect = getConnectedStoreId(data) != null;
    if (!hasStoreConnect && hasDirectTenantOverride(data)) {
      throw new AppError(
        400,
        "Direct companyId/branchId override is not allowed. Change storeId instead.",
        "INVALID_TENANT_OVERRIDE",
      );
    }
    const normalizedData = await deriveTenantFromConnectedStore(data);
    return prisma.order.update({
      where: { id },
      data: normalizedData,
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
    companyAdminOwnerUserId?: string;
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

    if (params.companyAdminOwnerUserId) {
      const uid = params.companyAdminOwnerUserId;
      andParts.push({
        OR: [
          { createdByUserId: uid },
          { ownerUserId: uid },
          { assignedCaptain: { createdByUserId: uid } },
        ],
      });
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
