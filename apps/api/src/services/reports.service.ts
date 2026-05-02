import {
  CaptainBalanceTransactionType,
  LedgerEntryType,
  OrderStatus,
  Prisma,
  WalletOwnerType,
} from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { isCompanyAdminRole, isSuperAdminRole, type AppRole } from "../lib/rbac-roles.js";
import { resolveStaffTenantOrderListFilter } from "./tenant-scope.service.js";
import { money } from "./ledger/money.js";
import {
  resolveDeliveryFeeForCommission,
  resolveDeliverySettlementFromDeliveryFee,
  resolveEffectivePlatformCommissionPercent,
} from "../domain/order-delivery-fee-for-commission.js";
import { LEDGER_REF_CAPTAIN_PREPAID_OP } from "../config/captain-prepaid-ledger.js";
import { AppError } from "../utils/errors.js";
import { normalizePaginationForPrisma } from "../utils/pagination.js";
import {
  captainDisplayI18nFromJson,
  storeDisplayI18nFromJson,
  userDisplayI18nFromJson,
} from "../lib/display-i18n.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_RANGE_MS = 90 * MS_PER_DAY;

const CHARGE_ADJUST_TYPES: CaptainBalanceTransactionType[] = [
  CaptainBalanceTransactionType.CHARGE,
  CaptainBalanceTransactionType.ADJUSTMENT,
];

const ORDERS_HISTORY_TOTALS_BATCH = 800;

/**
 * Sums store amount, delivery fees, customer collection for **all** matching orders; sums platform
 * commission, company profit, and captain balance deduction for **DELIVERED** only (delivery-fee basis).
 */
async function aggregateOrdersHistoryTotals(where: Prisma.OrderWhereInput): Promise<{
  totalStoreAmount: Prisma.Decimal;
  totalDeliveryFees: Prisma.Decimal;
  totalCustomerCollection: Prisma.Decimal;
  totalPlatformCommission: Prisma.Decimal;
  totalCompanyProfit: Prisma.Decimal;
  totalCaptainBalanceDeduction: Prisma.Decimal;
}> {
  const settings = await prisma.dashboardSettings.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });
  const captainFixed = money(settings.captainFixedSharePerDelivery);

  let skip = 0;
  let totalStore = money(0);
  let totalDelivery = money(0);
  let totalCustomer = money(0);
  let totalPlatform = money(0);
  let totalCompany = money(0);
  let totalCaptainDeduction = money(0);
  for (;;) {
    const batch = await prisma.order.findMany({
      where,
      select: {
        status: true,
        amount: true,
        deliveryFee: true,
        cashCollection: true,
        assignedCaptain: { select: { commissionPercent: true } },
      },
      orderBy: { id: "asc" },
      skip,
      take: ORDERS_HISTORY_TOTALS_BATCH,
    });
    if (batch.length === 0) break;
    for (const o of batch) {
      const fee = resolveDeliveryFeeForCommission({
        amount: o.amount,
        deliveryFee: o.deliveryFee,
        cashCollection: o.cashCollection,
      });
      totalStore = money(totalStore.plus(o.amount));
      totalDelivery = money(totalDelivery.plus(fee));
      totalCustomer = money(totalCustomer.plus(o.cashCollection));
      if (o.status === OrderStatus.DELIVERED) {
        const effectivePct = resolveEffectivePlatformCommissionPercent({
          prepaidAllowCaptainCustomCommission: settings.prepaidAllowCaptainCustomCommission,
          prepaidDefaultCommissionPercent: settings.prepaidDefaultCommissionPercent,
          captainCommissionPercentOverride: o.assignedCaptain?.commissionPercent ?? null,
        });
        const settlement = resolveDeliverySettlementFromDeliveryFee({
          deliveryFee: fee,
          platformCommissionPercent: effectivePct,
          captainFixedSharePerDelivery: captainFixed,
        });
        totalPlatform = money(totalPlatform.plus(settlement.platformCommission));
        totalCompany = money(totalCompany.plus(settlement.companyProfit));
        totalCaptainDeduction = money(totalCaptainDeduction.plus(settlement.captainBalanceDeduction));
      }
    }
    skip += ORDERS_HISTORY_TOTALS_BATCH;
    if (batch.length < ORDERS_HISTORY_TOTALS_BATCH) break;
  }
  return {
    totalStoreAmount: totalStore,
    totalDeliveryFees: totalDelivery,
    totalCustomerCollection: totalCustomer,
    totalPlatformCommission: totalPlatform,
    totalCompanyProfit: totalCompany,
    totalCaptainBalanceDeduction: totalCaptainDeduction,
  };
}

function parseDeliveredCaptainLedgerMetadata(meta: Prisma.JsonValue | null): {
  platformCommission?: string;
  companyProfit?: string;
  captainNetShare?: string;
  captainBalanceDeduction?: string;
} {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return {};
  const m = meta as Record<string, unknown>;
  const str = (k: string) => (typeof m[k] === "string" ? m[k] : undefined);
  return {
    platformCommission: str("platformCommission"),
    companyProfit: str("companyProfit"),
    captainNetShare: str("captainNetShare"),
    captainBalanceDeduction: str("captainBalanceDeduction"),
  };
}

export type ReconciliationActor = {
  userId: string;
  role: AppRole;
  companyId: string | null;
  branchId: string | null;
};

function parseRange(from: string, to: string) {
  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
    throw new AppError(400, "from and to must be valid ISO-8601 datetimes (UTC instants)", "INVALID_RANGE");
  }
  if (fromMs > toMs) {
    throw new AppError(400, "from must be on or before to", "INVALID_RANGE");
  }
  if (toMs - fromMs > MAX_RANGE_MS) {
    throw new AppError(400, "Date range may not exceed 90 days", "REPORT_RANGE_TOO_LARGE");
  }
  return { from: new Date(fromMs), to: new Date(toMs) };
}

/** Ledger lines tied to captains, scoped to tenant (company / optional branch for branch managers). */
async function buildCaptainLedgerScopeWhere(
  actor: ReconciliationActor,
): Promise<Prisma.LedgerEntryWhereInput> {
  if (isSuperAdminRole(actor.role)) {
    return {
      walletAccount: { ownerType: WalletOwnerType.CAPTAIN },
    };
  }
  const tenant = await resolveStaffTenantOrderListFilter({
    userId: actor.userId,
    role: actor.role,
    companyId: actor.companyId,
    branchId: actor.branchId,
  });
  if (!tenant.companyId) {
    return { walletAccount: { ownerType: WalletOwnerType.CAPTAIN } };
  }
  if (tenant.branchId) {
    const caps = await prisma.captain.findMany({
      where: {
        companyId: tenant.companyId,
        branchId: tenant.branchId,
        ...(isCompanyAdminRole(actor.role) ? { createdByUserId: actor.userId } : {}),
      },
      select: { id: true },
    });
    const ids = caps.map((c) => c.id);
    if (ids.length === 0) {
      return { id: { in: [] } };
    }
    return {
      walletAccount: {
        ownerType: WalletOwnerType.CAPTAIN,
        ownerId: { in: ids },
      },
    };
  }
  if (isCompanyAdminRole(actor.role)) {
    const caps = await prisma.captain.findMany({
      where: { companyId: tenant.companyId, createdByUserId: actor.userId },
      select: { id: true },
    });
    const ids = caps.map((c) => c.id);
    if (ids.length === 0) {
      return { id: { in: [] } };
    }
    return {
      walletAccount: {
        ownerType: WalletOwnerType.CAPTAIN,
        ownerId: { in: ids },
      },
    };
  }
  return {
    walletAccount: { ownerType: WalletOwnerType.CAPTAIN, companyId: tenant.companyId },
  };
}

/**
 * Delivers path: `ORDER_DELIVERED_CAPTAIN_DEDUCTION` lines vs `captain_balance_transactions` DEDUCTION (mirror).
 */
async function deliverLedgerVsPrepaidSummary(
  range: { from: Date; to: Date },
  captainScope: Prisma.LedgerEntryWhereInput,
) {
  const whereBase: Prisma.LedgerEntryWhereInput = {
    ...captainScope,
    entryType: LedgerEntryType.ORDER_DELIVERED_CAPTAIN_DEDUCTION,
    orderId: { not: null },
    createdAt: { gte: range.from, lte: range.to },
  };
  const ledgerRows = await prisma.ledgerEntry.findMany({
    where: whereBase,
    select: {
      id: true,
      orderId: true,
      amount: true,
      walletAccount: { select: { ownerId: true, ownerType: true } },
    },
  });
  const relevant = ledgerRows.filter((le) => le.walletAccount?.ownerType === WalletOwnerType.CAPTAIN);
  if (relevant.length === 0) {
    return {
      ledgerLineCount: 0,
      missingPrepaidMirrorCount: 0,
      amountMismatchCount: 0,
    };
  }
  const orderIds = [...new Set(relevant.map((r) => r.orderId).filter(Boolean))] as string[];
  const capPairs = relevant.map((r) => r.walletAccount!.ownerId);
  const capIds = [...new Set(capPairs)];
  const prepaidRows = await prisma.captainBalanceTransaction.findMany({
    where: {
      captainId: { in: capIds },
      orderId: { in: orderIds },
      type: CaptainBalanceTransactionType.DEDUCTION,
    },
    select: { id: true, captainId: true, orderId: true, amount: true },
  });
  const key = (captainId: string, orderId: string) => `${captainId}::${orderId}`;
  const prepaidMap = new Map<string, (typeof prepaidRows)[0]>();
  for (const p of prepaidRows) {
    if (p.orderId) prepaidMap.set(key(p.captainId, p.orderId), p);
  }
  let missing = 0;
  let mismatch = 0;
  for (const le of relevant) {
    const oid = le.orderId;
    if (!oid) continue;
    const capId = le.walletAccount!.ownerId;
    const p = prepaidMap.get(key(capId, oid));
    const ledgerAbs = money(le.amount).abs();
    if (!p) {
      missing += 1;
      continue;
    }
    if (!money(p.amount).equals(ledgerAbs)) {
      mismatch += 1;
    }
  }
  return {
    ledgerLineCount: relevant.length,
    missingPrepaidMirrorCount: missing,
    amountMismatchCount: mismatch,
  };
}

/**
 * Charge/Adjust path: CBT with `prepaid_ledger_operation_id` vs ledger by ref.
 */
async function chargeAdjustAlignmentSummary(
  range: { from: Date; to: Date },
  actor: ReconciliationActor,
) {
  const cbtWhere: Prisma.CaptainBalanceTransactionWhereInput = {
    type: { in: CHARGE_ADJUST_TYPES },
    createdAt: { gte: range.from, lte: range.to },
  };
  if (!isSuperAdminRole(actor.role)) {
    const tenant = await resolveStaffTenantOrderListFilter({
      userId: actor.userId,
      role: actor.role,
      companyId: actor.companyId,
      branchId: actor.branchId,
    });
    if (tenant.companyId) {
      cbtWhere.captain = {
        companyId: tenant.companyId,
        ...(tenant.branchId ? { branchId: tenant.branchId } : {}),
        ...(isCompanyAdminRole(actor.role) ? { createdByUserId: actor.userId } : {}),
      };
    }
  }
  const cbts = await prisma.captainBalanceTransaction.findMany({
    where: cbtWhere,
    select: {
      id: true,
      captainId: true,
      type: true,
      amount: true,
      prepaidLedgerOperationId: true,
    },
  });
  let missingLedger = 0;
  let amountMismatch = 0;
  const opIds = [...new Set(cbts.map((r) => r.prepaidLedgerOperationId).filter(Boolean))] as string[];
  const ledgerByRef = new Map<string, { amount: Prisma.Decimal; entryType: LedgerEntryType }>();
  if (opIds.length > 0) {
    const ledgerRows = await prisma.ledgerEntry.findMany({
      where: {
        referenceType: LEDGER_REF_CAPTAIN_PREPAID_OP,
        referenceId: { in: opIds },
        entryType: { in: [LedgerEntryType.CAPTAIN_PREPAID_CHARGE, LedgerEntryType.CAPTAIN_PREPAID_ADJUSTMENT] },
      },
      select: { referenceId: true, amount: true, entryType: true },
    });
    for (const row of ledgerRows) {
      if (row.referenceId) ledgerByRef.set(row.referenceId, { amount: row.amount, entryType: row.entryType });
    }
  }
  for (const row of cbts) {
    const opId = row.prepaidLedgerOperationId;
    if (!opId) {
      missingLedger += 1;
      continue;
    }
    const wantType =
      row.type === CaptainBalanceTransactionType.CHARGE
        ? LedgerEntryType.CAPTAIN_PREPAID_CHARGE
        : LedgerEntryType.CAPTAIN_PREPAID_ADJUSTMENT;
    const le = ledgerByRef.get(opId);
    if (!le || le.entryType !== wantType) {
      missingLedger += 1;
      continue;
    }
    if (!money(row.amount).equals(money(le.amount))) {
      amountMismatch += 1;
    }
  }
  const capScope = await buildCaptainLedgerScopeWhere(actor);
  const candidateLedger = await prisma.ledgerEntry.findMany({
    where: {
      AND: [
        capScope,
        {
          entryType: { in: [LedgerEntryType.CAPTAIN_PREPAID_CHARGE, LedgerEntryType.CAPTAIN_PREPAID_ADJUSTMENT] },
          referenceType: LEDGER_REF_CAPTAIN_PREPAID_OP,
          referenceId: { not: null },
          createdAt: { gte: range.from, lte: range.to },
        },
      ],
    },
    select: { id: true, referenceId: true, amount: true },
  });
  let orphan = 0;
  const ledgerRefs = [...new Set(candidateLedger.map((e) => e.referenceId).filter(Boolean))] as string[];
  const cbtRefs = new Set<string>();
  if (ledgerRefs.length > 0) {
    const linkedCbts = await prisma.captainBalanceTransaction.findMany({
      where: { prepaidLedgerOperationId: { in: ledgerRefs } },
      select: { prepaidLedgerOperationId: true },
    });
    for (const row of linkedCbts) {
      if (row.prepaidLedgerOperationId) cbtRefs.add(row.prepaidLedgerOperationId);
    }
  }
  for (const e of candidateLedger) {
    const ref = e.referenceId;
    if (!ref) continue;
    if (!cbtRefs.has(ref)) orphan += 1;
  }
  return {
    cbtRowCount: cbts.length,
    missingOrMismatchedLedgerCount: missingLedger,
    amountMismatchCount: amountMismatch,
    orphanLedgerRowsWithoutCbtCount: orphan,
  };
}

export const reportsService = {
  async getReconciliationSummary(
    actor: ReconciliationActor,
    params: { from: string; to: string },
  ) {
    const range = parseRange(params.from, params.to);
    const captainScope = await buildCaptainLedgerScopeWhere(actor);
    const deliver = await deliverLedgerVsPrepaidSummary(range, captainScope);
    const chargeAdjust = await chargeAdjustAlignmentSummary(range, actor);
    return {
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      deliverLedgerVsPrepaid: deliver,
      chargeAdjustAlignment: chargeAdjust,
    };
  },

  async listDeliveredCommissions(
    actor: ReconciliationActor,
    params: { from: string; to: string; page: number; pageSize: number },
  ) {
    const range = parseRange(params.from, params.to);
    const { skip, take } = normalizePaginationForPrisma(params);
    const captainScope = await buildCaptainLedgerScopeWhere(actor);
    const where: Prisma.LedgerEntryWhereInput = {
      AND: [
        captainScope,
        {
          entryType: LedgerEntryType.ORDER_DELIVERED_CAPTAIN_DEDUCTION,
          orderId: { not: null },
          createdAt: { gte: range.from, lte: range.to },
          order: { status: OrderStatus.DELIVERED, archivedAt: null },
        },
      ],
    };
    const [total, rows] = await prisma.$transaction([
      prisma.ledgerEntry.count({ where }),
      prisma.ledgerEntry.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        select: {
          id: true,
          amount: true,
          currency: true,
          createdAt: true,
          orderId: true,
          metadata: true,
          order: {
            select: {
              orderNumber: true,
              status: true,
              amount: true,
              deliveryFee: true,
              cashCollection: true,
              assignedCaptainId: true,
              store: { select: { name: true, area: true, displayI18n: true } },
              assignedCaptain: {
                select: {
                  id: true,
                  commissionPercent: true,
                  displayI18n: true,
                  user: { select: { fullName: true, displayI18n: true } },
                },
              },
            },
          },
        },
      }),
    ]);
    const dashSettings = await prisma.dashboardSettings.upsert({
      where: { id: "default" },
      create: { id: "default" },
      update: {},
    });
    const items = rows.map((r) => {
      const o = r.order!;
      const captainDeductionLedger = money(r.amount).abs();
      const feeForRow = resolveDeliveryFeeForCommission({
        amount: o.amount,
        deliveryFee: o.deliveryFee,
        cashCollection: o.cashCollection,
      });
      const parsed = parseDeliveredCaptainLedgerMetadata(r.metadata);
      const effectivePct = resolveEffectivePlatformCommissionPercent({
        prepaidAllowCaptainCustomCommission: dashSettings.prepaidAllowCaptainCustomCommission,
        prepaidDefaultCommissionPercent: dashSettings.prepaidDefaultCommissionPercent,
        captainCommissionPercentOverride: o.assignedCaptain?.commissionPercent ?? null,
      });
      const fallbackSettlement = resolveDeliverySettlementFromDeliveryFee({
        deliveryFee: feeForRow,
        platformCommissionPercent: effectivePct,
        captainFixedSharePerDelivery: dashSettings.captainFixedSharePerDelivery,
      });
      const storeDi = storeDisplayI18nFromJson(o.store.displayI18n ?? undefined);
      const capUi = o.assignedCaptain?.user ? userDisplayI18nFromJson(o.assignedCaptain.user.displayI18n ?? undefined) : undefined;
      const capArea = o.assignedCaptain ? captainDisplayI18nFromJson(o.assignedCaptain.displayI18n ?? undefined) : undefined;
      const envelope = {
        ...(storeDi?.name ? { storeName: storeDi.name } : {}),
        ...(storeDi?.area ? { storeArea: storeDi.area } : {}),
        ...(capUi?.fullName ? { captainName: capUi.fullName } : {}),
        ...(capArea?.area ? { captainArea: capArea.area } : {}),
      };
      const hasEnvelope = Object.keys(envelope).length > 0;

      return {
        ledgerEntryId: r.id,
        orderId: r.orderId!,
        orderNumber: o.orderNumber,
        storeName: o.store.name,
        storeArea: o.store.area,
        captainId: o.assignedCaptainId ?? o.assignedCaptain?.id ?? null,
        captainName: o.assignedCaptain?.user?.fullName ?? null,
        deliveryFee: feeForRow.toFixed(2),
        platformCommission: parsed.platformCommission ?? fallbackSettlement.platformCommission.toFixed(2),
        companyProfit: parsed.companyProfit ?? fallbackSettlement.companyProfit.toFixed(2),
        captainNetShare: parsed.captainNetShare ?? fallbackSettlement.captainNetShare.toFixed(2),
        captainBalanceDeduction: parsed.captainBalanceDeduction ?? fallbackSettlement.captainBalanceDeduction.toFixed(2),
        /** Same as captain wallet deduction amount (`abs(ledger.amount)`). */
        commissionAmount: captainDeductionLedger.toFixed(2),
        currency: r.currency,
        ledgerCreatedAt: r.createdAt.toISOString(),
        ...(hasEnvelope ? { displayI18n: envelope } : {}),
      };
    });
    return {
      total,
      page: params.page,
      pageSize: params.pageSize,
      items,
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
    };
  },

  async listOrdersHistory(
    actor: ReconciliationActor,
    params: {
      from: string;
      to: string;
      page: number;
      pageSize: number;
      captainId?: string;
      storeId?: string;
      status?: OrderStatus;
    },
  ) {
    const range = parseRange(params.from, params.to);
    const { skip, take } = normalizePaginationForPrisma(params);
    const tenant = isSuperAdminRole(actor.role)
      ? {}
      : await resolveStaffTenantOrderListFilter({
          userId: actor.userId,
          role: actor.role,
          companyId: actor.companyId,
          branchId: actor.branchId,
        });

    const where: Prisma.OrderWhereInput = {
      ...(tenant.companyId ? { companyId: tenant.companyId } : {}),
      ...(tenant.branchId ? { branchId: tenant.branchId } : {}),
      ...(actor.role === "COMPANY_ADMIN"
        ? {
            OR: [
              { createdByUserId: actor.userId },
              { ownerUserId: actor.userId },
              { assignedCaptain: { createdByUserId: actor.userId } },
            ],
          }
        : {}),
      ...(params.captainId ? { assignedCaptainId: params.captainId } : {}),
      ...(params.storeId ? { storeId: params.storeId } : {}),
      ...(params.status ? { status: params.status } : {}),
      createdAt: { gte: range.from, lte: range.to },
      archivedAt: null,
    };

    const [total, rows] = await prisma.$transaction([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        skip,
        take,
        orderBy: [{ createdAt: "desc" }, { updatedAt: "desc" }],
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          status: true,
          createdAt: true,
          pickedUpAt: true,
          deliveredAt: true,
          amount: true,
          cashCollection: true,
          deliveryFee: true,
          store: { select: { name: true, area: true, displayI18n: true } },
          assignedCaptain: {
            select: {
              commissionPercent: true,
              displayI18n: true,
              user: { select: { fullName: true, phone: true, displayI18n: true } },
            },
          },
          assignmentLogs: {
            select: { assignedAt: true, responseStatus: true },
            orderBy: { assignedAt: "asc" },
            take: 100,
          },
        },
      }),
    ]);

    const dashSettings = await prisma.dashboardSettings.upsert({
      where: { id: "default" },
      create: { id: "default" },
      update: {},
    });

    const items = rows.map((row) => {
      const logsAsc = row.assignmentLogs;
      const firstAssigned = logsAsc.length ? logsAsc[0]!.assignedAt : null;
      const firstAccepted = logsAsc.find((x) => x.responseStatus === "ACCEPTED")?.assignedAt ?? null;
      const deliveryFeeResolved = resolveDeliveryFeeForCommission({
        amount: row.amount,
        deliveryFee: row.deliveryFee,
        cashCollection: row.cashCollection,
      });
      const effectivePct = resolveEffectivePlatformCommissionPercent({
        prepaidAllowCaptainCustomCommission: dashSettings.prepaidAllowCaptainCustomCommission,
        prepaidDefaultCommissionPercent: dashSettings.prepaidDefaultCommissionPercent,
        captainCommissionPercentOverride: row.assignedCaptain?.commissionPercent ?? null,
      });
      const settlement = resolveDeliverySettlementFromDeliveryFee({
        deliveryFee: deliveryFeeResolved,
        platformCommissionPercent: effectivePct,
        captainFixedSharePerDelivery: dashSettings.captainFixedSharePerDelivery,
      });
      const estimatePlatformOnly = money(deliveryFeeResolved.mul(effectivePct).div(100));
      const storeDi = storeDisplayI18nFromJson(row.store.displayI18n ?? undefined);
      const capUi = row.assignedCaptain?.user ? userDisplayI18nFromJson(row.assignedCaptain.user.displayI18n ?? undefined) : undefined;
      const capArea = row.assignedCaptain ? captainDisplayI18nFromJson(row.assignedCaptain.displayI18n ?? undefined) : undefined;
      const historyEnvelope = {
        ...(storeDi?.name ? { storeName: storeDi.name } : {}),
        ...(storeDi?.area ? { storeArea: storeDi.area } : {}),
        ...(capUi?.fullName ? { captainName: capUi.fullName } : {}),
        ...(capArea?.area ? { captainArea: capArea.area } : {}),
      };
      const hasHistoryEnvelope = Object.keys(historyEnvelope).length > 0;

      const delivered = row.status === OrderStatus.DELIVERED;

      return {
        orderNumber: row.orderNumber,
        storeName: row.store.name,
        captainName: row.assignedCaptain?.user.fullName ?? null,
        captainPhone: row.assignedCaptain?.user.phone ?? null,
        customerName: row.customerName ?? null,
        status: row.status,
        assignedAt: firstAssigned ? firstAssigned.toISOString() : null,
        acceptedAt: firstAccepted ? firstAccepted.toISOString() : null,
        pickupAt: row.pickedUpAt ? row.pickedUpAt.toISOString() : null,
        deliveredAt: row.deliveredAt ? row.deliveredAt.toISOString() : null,
        storeAmount: Number(money(row.amount).toFixed(2)),
        deliveryFee: Number(deliveryFeeResolved.toFixed(2)),
        customerCollectionAmount: Number(money(row.cashCollection).toFixed(2)),
        /** Platform commission: settled split when DELIVERED; otherwise %×fee estimate only. */
        profitOrCommission: Number((delivered ? settlement.platformCommission : estimatePlatformOnly).toFixed(2)),
        platformCommission: delivered ? Number(settlement.platformCommission.toFixed(2)) : null,
        companyProfit: delivered ? Number(settlement.companyProfit.toFixed(2)) : null,
        captainNetShare: delivered ? Number(settlement.captainNetShare.toFixed(2)) : null,
        captainBalanceDeduction: delivered ? Number(settlement.captainBalanceDeduction.toFixed(2)) : null,
        ...(hasHistoryEnvelope ? { displayI18n: historyEnvelope } : {}),
      };
    });

    const totalsAgg = await aggregateOrdersHistoryTotals(where);

    return {
      rows: items,
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
      totals: {
        totalStoreAmount: Number(totalsAgg.totalStoreAmount.toFixed(2)),
        totalDeliveryFees: Number(totalsAgg.totalDeliveryFees.toFixed(2)),
        totalCustomerCollection: Number(totalsAgg.totalCustomerCollection.toFixed(2)),
        totalPlatformCommission: Number(totalsAgg.totalPlatformCommission.toFixed(2)),
        totalCompanyProfit: Number(totalsAgg.totalCompanyProfit.toFixed(2)),
        totalCaptainBalanceDeduction: Number(totalsAgg.totalCaptainBalanceDeduction.toFixed(2)),
      },
      /** Rows are filtered by `orders.created_at` in `[from, to]` (UTC). Not delivery time. */
      dateFilter: {
        field: "created_at" as const,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },
    };
  },
};
