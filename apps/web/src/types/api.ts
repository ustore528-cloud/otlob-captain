import type { OrderFinancialBreakdownDto } from "@captain/shared";

/** أشكال JSON القادمة من API — مطابقة تقريبية لـ Prisma */

/** Per-locale display copy from API (read-only). Does not replace stored fields on the server. */
export type ValueTranslations = {
  en?: string | null;
  ar?: string | null;
  he?: string | null;
};

export type StoreSubscriptionType = "PUBLIC" | "SUPERVISOR_LINKED";

/** مشرف مرتبط بالمتجر أو الكابتن — نفس شكل الـ API */
export type StoreSupervisorUser = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  role: string;
  companyId: string | null;
  branchId: string | null;
  displayI18n?: { fullName?: ValueTranslations };
} | null;

export type StorePrimaryRegionSummary = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  displayI18n?: { name?: ValueTranslations };
} | null;

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "ASSIGNED"
  | "ACCEPTED"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "CANCELLED";

export type DistributionMode = "AUTO" | "MANUAL";

/** Optional display-layer strings for dashboard orders (see `getLocalizedText` in i18n). */
export type OrderDisplayI18n = {
  customerName?: ValueTranslations;
  storeName?: ValueTranslations;
  storeArea?: ValueTranslations;
  area?: ValueTranslations;
  pickupAddress?: ValueTranslations;
  dropoffAddress?: ValueTranslations;
  notes?: ValueTranslations;
  primaryRegionName?: ValueTranslations;
  supervisorName?: ValueTranslations;
  /** Overrides nested captain `user.displayI18n` when set. */
  assignedCaptainName?: ValueTranslations;
};

export type OrderListItem = {
  id: string;
  orderNumber: string;
  /** Per-company UI sequence from API; null until backfill for legacy rows. */
  displayOrderNo?: number | null;
  status: OrderStatus;
  distributionMode: DistributionMode;
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  dropoffAddress: string;
  area: string;
  amount: string;
  cashCollection: string;
  /** Persisted delivery fee; null on legacy rows (UI infers fee for display). */
  deliveryFee?: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  store: {
    id: string;
    name: string;
    area: string;
    subscriptionType: StoreSubscriptionType;
    supervisorUser: StoreSupervisorUser;
    primaryRegion: StorePrimaryRegionSummary;
    displayI18n?: {
      name?: ValueTranslations;
      area?: ValueTranslations;
      address?: ValueTranslations;
      primaryRegionName?: ValueTranslations;
    };
  };
  assignedCaptain: null | {
    id: string;
    user: { fullName: string; phone: string; displayI18n?: { fullName?: ValueTranslations } };
    displayI18n?: { area?: ValueTranslations };
  };
  /** نهاية مهلة قبول العرض الحالي (ASSIGNED + عرض PENDING) — ISO من الخادم */
  pendingOfferExpiresAt?: string | null;
  displayI18n?: OrderDisplayI18n;
};

export type OrderAssignmentLogItem = {
  id: string;
  captainId: string;
  assignmentType: string;
  assignedAt: string;
  responseStatus: string;
  expiredAt: string | null;
  notes: string | null;
};

/** `GET /orders/:id` — يُستخدم لعرض تفاصيل المتجر في الواجهة */
export type OrderDetail = {
  id: string;
  orderNumber: string;
  displayOrderNo?: number | null;
  assignedCaptainId: string | null;
  status: OrderStatus;
  distributionMode: DistributionMode;
  companyId: string;
  branchId: string;
  customerName: string;
  customerPhone: string;
  senderFullName?: string | null;
  senderPhone?: string | null;
  pickupAddress: string;
  dropoffAddress: string;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  area: string;
  amount: string;
  cashCollection: string;
  deliveryFee: string | null;
  financialBreakdown: OrderFinancialBreakdownDto;
  /** delivery fee × captain commission % (display estimate). */
  commissionEstimate?: string | null;
  /** Earliest assignment log time. */
  assignedAt?: string | null;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
  notes: string | null;
  store: {
    id: string;
    name: string;
    area: string;
    phone?: string;
    subscriptionType: StoreSubscriptionType;
    supervisorUser: StoreSupervisorUser;
    primaryRegion: StorePrimaryRegionSummary;
    displayI18n?: {
      name?: ValueTranslations;
      area?: ValueTranslations;
      address?: ValueTranslations;
      primaryRegionName?: ValueTranslations;
    };
  };
  createdAt: string;
  updatedAt: string;
  assignmentLogs: OrderAssignmentLogItem[];
  displayI18n?: OrderDisplayI18n;
};

export type Paginated<T> = { total: number; items: T[] };

export type CaptainListItem = {
  id: string;
  vehicleType: string;
  area: string;
  isActive: boolean;
  availabilityStatus: string;
  prepaidBalance?: string;
  commissionPercent?: string | null;
  prepaidEnabled?: boolean;
  totalCharged?: string;
  totalDeducted?: string;
  minimumBalanceToReceiveOrders?: string | null;
  lastBalanceUpdatedAt?: string | null;
  lastSeenAt: string | null;
  user: {
    id: string;
    fullName: string;
    phone: string;
    isActive: boolean;
    displayI18n?: { fullName?: ValueTranslations };
  };
  supervisorUser: StoreSupervisorUser;
  displayI18n?: { area?: ValueTranslations };
};

export type CaptainPrepaidReadAlignment = {
  displayBalance: string;
  walletBalance: string | null;
  prepaidBalance: string;
  parity: "OK" | "NO_WALLET" | "MISMATCH";
};

export type CaptainPrepaidSummary = {
  captainId: string;
  currentBalance: string;
  prepaidBalance: string;
  commissionPercent: string;
  prepaidEnabled: boolean;
  captainPrepaidEnabled: boolean;
  systemPrepaidEnabled: boolean;
  totalCharged: string;
  totalDeducted: string;
  minimumBalanceToReceiveOrders: string;
  lowBalance: boolean;
  blockedFromReceivingOrders: boolean;
  blockReason: string | null;
  estimatedRemainingOrders: number | null;
  lastBalanceUpdatedAt: string | null;
  lastChargeAt: string | null;
  lastDeductionAt: string | null;
  explanationText: string;
  readAlignment?: CaptainPrepaidReadAlignment;
};

export type CaptainPrepaidTransaction = {
  id: string;
  captainId: string;
  type: "charge" | "deduction" | "refund" | "adjustment";
  amount: string;
  balanceAfter: string;
  commissionPercentSnapshot: string | null;
  deliveryFeeSnapshot: string | null;
  orderId: string | null;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
};

/** `GET /api/v1/reports/reconciliation-summary` */
export type ReconciliationSummaryDto = {
  range: { from: string; to: string };
  deliverLedgerVsPrepaid: {
    ledgerLineCount: number;
    missingPrepaidMirrorCount: number;
    amountMismatchCount: number;
  };
  chargeAdjustAlignment: {
    cbtRowCount: number;
    missingOrMismatchedLedgerCount: number;
    amountMismatchCount: number;
    orphanLedgerRowsWithoutCbtCount: number;
  };
};

/** `GET /api/v1/reports/delivered-commissions` */
export type DeliveredCommissionReportItem = {
  ledgerEntryId: string;
  orderId: string;
  orderNumber: string;
  storeName: string;
  storeArea: string;
  captainId: string | null;
  captainName: string | null;
  deliveryFee: string;
  commissionAmount: string;
  currency: string;
  ledgerCreatedAt: string;
  /** Optional localized labels for dimensions above (additive). */
  displayI18n?: {
    storeName?: ValueTranslations;
    storeArea?: ValueTranslations;
    captainName?: ValueTranslations;
    captainArea?: ValueTranslations;
  };
};

export type DeliveredCommissionReportPage = {
  total: number;
  page: number;
  pageSize: number;
  items: DeliveredCommissionReportItem[];
  range: { from: string; to: string };
};

export type OrdersHistoryReportRow = {
  orderNumber: string;
  storeName: string;
  captainName: string | null;
  captainPhone: string | null;
  customerName: string | null;
  status: string;
  assignedAt: string | null;
  acceptedAt: string | null;
  /** Persisted pickup instant (`orders.picked_up_at`); null if never reached PICKED_UP. */
  pickupAt: string | null;
  /** Persisted delivery instant (`orders.delivered_at`); null if not delivered. */
  deliveredAt: string | null;
  storeAmount: number;
  deliveryFee: number;
  customerCollectionAmount: number;
  /** Commission estimate: delivery fee × captain commission % (same basis as list row). */
  profitOrCommission: number;
  displayI18n?: {
    storeName?: ValueTranslations;
    storeArea?: ValueTranslations;
    captainName?: ValueTranslations;
    captainArea?: ValueTranslations;
  };
};

export type OrdersHistoryReportPage = {
  rows: OrdersHistoryReportRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  /** Sum over all orders matching the same filters as `rows` (entire filtered dataset, not current page only). */
  totals: {
    totalStoreAmount: number;
    totalDeliveryFees: number;
    totalCustomerCollection: number;
    totalProfitOrCommission: number;
  };
  dateFilter: {
    field: "created_at";
    from: string;
    to: string;
  };
};

export type StoreListItem = {
  id: string;
  name: string;
  phone: string;
  area: string;
  address: string;
  isActive: boolean;
  subscriptionType: StoreSubscriptionType;
  supervisorUser: StoreSupervisorUser;
  primaryRegion: StorePrimaryRegionSummary;
  displayI18n?: {
    name?: ValueTranslations;
    area?: ValueTranslations;
    address?: ValueTranslations;
    primaryRegionName?: ValueTranslations;
  };
};

export type UserListItem = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  role: string;
  isActive: boolean;
  companyId?: string | null;
  branchId?: string | null;
  publicOwnerCode?: string | null;
  displayI18n?: { fullName?: ValueTranslations };
  createdAt: string;
  updatedAt: string;
  /** حقول حساب عميل التطبيق (CUSTOMER) — مطابقة لحقول «طلب جديد» */
  customerPickupAddress: string | null;
  customerDropoffAddress: string | null;
  customerLocationLink: string | null;
  customerArea: string | null;
  customerDropoffLat: number | null;
  customerDropoffLng: number | null;
  customerPreferredAmount: string | null;
  customerPreferredDelivery: string | null;
};

export type ActiveMapCaptain = {
  id: string;
  /** حساب المستخدم المرتبط بالكابتن — مطلوب لإنشاء إشعارات تصل لتطبيق الكابتن */
  userId?: string;
  area: string;
  availabilityStatus: string;
  vehicleType: string;
  /** `user.id` يطابق `userId` عندما يكون الحقل العلوي غائباً (كاش قديم) */
  user: { id?: string; fullName: string; phone: string; displayI18n?: { fullName?: ValueTranslations } };
  displayI18n?: { area?: ValueTranslations };
  lastLocation: null | {
    captainId: string;
    latitude: number;
    longitude: number;
    recordedAt: string;
  };
  waitingOffers: number;
  activeOrders: number;
  latestOrderNumber: string | null;
  latestOrderStatus: string | null;
  /** رفض طلبات AUTO خلال آخر ~15 دقيقة (للتلوين على الخريطة) */
  recentRejects: number;
  /** نهاية مهلة قبول العرض الحالي (PENDING) — للعد التنازلي على الخريطة */
  assignmentOfferExpiresAt: string | null;
};

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  displayI18n?: { title?: ValueTranslations; body?: ValueTranslations };
};

export type ActivityItem = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: unknown;
  createdAt: string;
  user?: { id: string; fullName: string; phone: string; role: string } | null;
};

export type CaptainStats = {
  captainId: string;
  ordersDelivered: number;
  activeOrders: number;
  lastLocation: {
    latitude: number;
    longitude: number;
    recordedAt: string;
  } | null;
};

/** إعدادات اللوحة (صف واحد في الخادم) — قيم الخريطة الافتراضية تُخزَّن إحداثياً. */
export type DashboardSettingsDto = {
  id: string;
  mapCountry: string | null;
  mapCityRegion: string | null;
  mapDefaultLat: number | null;
  mapDefaultLng: number | null;
  mapDefaultZoom: number | null;
  prepaidCaptainsEnabled: boolean;
  prepaidDefaultCommissionPercent: string;
  prepaidAllowCaptainCustomCommission: boolean;
  prepaidMinimumBalanceToReceiveOrders: string;
  prepaidAllowManualAssignmentOverride: boolean;
  updatedAt: string;
};

export type FinanceWalletOwnerType = "STORE" | "CAPTAIN" | "SUPERVISOR_USER";

export type FinanceLedgerEntryType =
  | "SUPER_ADMIN_TOP_UP"
  | "WALLET_TRANSFER"
  | "ORDER_DELIVERED_STORE_DEBIT"
  | "ORDER_DELIVERED_CAPTAIN_DEDUCTION"
  | "ADJUSTMENT"
  | "CAPTAIN_PREPAID_CHARGE"
  | "CAPTAIN_PREPAID_ADJUSTMENT";

/** DTOs من `GET /api/v1/finance/...` — تطابق خدمة `walletReadService`. */
export type WalletBalanceReadDto = {
  walletAccountId: string | null;
  companyId: string;
  ownerType: FinanceWalletOwnerType;
  ownerId: string;
  balanceCached: string;
  currency: string;
  exists: boolean;
};

export type FinanceLedgerEntryReadDto = {
  id: string;
  createdAt: string;
  entryType: FinanceLedgerEntryType;
  amount: string;
  currency: string;
  orderId: string | null;
  referenceType: string | null;
  referenceId: string | null;
  counterpartyAccountId: string | null;
  /** يفرضه الخادم: مفاتيح آمنة فقط. */
  metadata: Record<string, string> | null;
};

export type FinanceLedgerHistoryPageDto = {
  items: FinanceLedgerEntryReadDto[];
  nextOffset: number | null;
  totalReturned: number;
};

/** `GET /api/v1/finance/wallet-accounts/:id/ledger-activity?from&to&offset&limit` */
export type LedgerActivityReportDto = {
  walletAccountId: string;
  range: { from: string; to: string };
  items: FinanceLedgerEntryReadDto[];
  nextOffset: number | null;
  totalReturned: number;
  totalInRange: number;
};

/** نتيجة `POST /api/v1/super-admin/wallets/.../top-up` */
export type WalletTopUpResultDto = {
  walletAccountId: string;
  ledgerEntryId: string;
  newBalanceCached: string;
  idempotent: boolean;
};

/**
 * `POST /api/v1/super-admin/wallets/company/:companyId/top-up` — idempotency في **body** (`idempotencyKey`)، ليس `Idempotency-Key` header.
 */
export type CompanyWalletTopUpResultDto = {
  companyId: string;
  walletId: string;
  balanceBefore: string;
  balanceAfter: string;
  ledgerEntryId: string;
  idempotencyKey: string;
  idempotent: boolean;
};

/** `GET /api/v1/finance/company-wallet/me` — قراءة فقط; `GET /api/v1/finance/company-wallet/:companyId` — مدير النظام فقط. */
export type CompanyWalletLedgerSummaryLine = {
  id: string;
  entryType: string;
  amount: string;
  currency: string;
  createdAt: string;
  idempotencyKey: string | null;
};

export type CompanyWalletReadDto = {
  companyId: string;
  walletId: string;
  balance: string;
  currency: string;
  updatedAt: string;
  recentLedger: CompanyWalletLedgerSummaryLine[];
};

/** نتيجة `POST /api/v1/supervisor/wallets/transfers/to-captain` */
export type SupervisorCaptainTransferResultDto = {
  fromWalletAccountId: string;
  toWalletAccountId: string;
  fromLedgerEntryId: string;
  toLedgerEntryId: string;
  newFromBalanceCached: string;
  newToBalanceCached: string;
  idempotent: boolean;
};
