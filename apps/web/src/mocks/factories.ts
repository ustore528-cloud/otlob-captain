import type {
  ActivityItem,
  ActiveMapCaptain,
  CaptainListItem,
  NotificationItem,
  OrderListItem,
  OrderStatus,
  StoreListItem,
  UserListItem,
} from "@/types/api";
import type { DashboardStats } from "@/lib/dashboard-stats";

/** بيانات وهمية آمنة للاختبارات — نفس الشكل الذي يعيده الـ backend */
export function mockOrderListItem(over: Partial<OrderListItem> = {}): OrderListItem {
  const status = (over.status ?? "PENDING") as OrderStatus;
  return {
    id: over.id ?? "mock-order-id",
    orderNumber: over.orderNumber ?? "ORD-MOCK-1",
    status,
    distributionMode: over.distributionMode ?? "AUTO",
    customerName: over.customerName ?? "عميل تجريبي",
    customerPhone: over.customerPhone ?? "+966500000000",
    pickupAddress: over.pickupAddress ?? "عنوان استلام",
    dropoffAddress: over.dropoffAddress ?? "عنوان تسليم",
    area: over.area ?? "الرياض",
    amount: over.amount ?? "100.00",
    cashCollection: over.cashCollection ?? "0.00",
    notes: over.notes ?? null,
    createdAt: over.createdAt ?? new Date().toISOString(),
    store: over.store ?? { id: "store-1", name: "متجر", area: "الرياض" },
    assignedCaptain: over.assignedCaptain ?? null,
    pendingOfferExpiresAt: over.pendingOfferExpiresAt ?? null,
  };
}

export function mockCaptainListItem(over: Partial<CaptainListItem> = {}): CaptainListItem {
  return {
    id: over.id ?? "mock-captain-id",
    vehicleType: over.vehicleType ?? "motorcycle",
    area: over.area ?? "الرياض",
    isActive: over.isActive ?? true,
    availabilityStatus: over.availabilityStatus ?? "AVAILABLE",
    lastSeenAt: over.lastSeenAt ?? null,
    user: over.user ?? {
      id: "user-captain-1",
      fullName: "كابتن تجريبي",
      phone: "+966511111111",
      isActive: true,
    },
  };
}

export function mockActiveMapCaptain(over: Partial<ActiveMapCaptain> = {}): ActiveMapCaptain {
  return {
    id: over.id ?? "cap-map-1",
    userId: over.userId ?? "user-captain-map-1",
    area: over.area ?? "الرياض",
    availabilityStatus: over.availabilityStatus ?? "AVAILABLE",
    vehicleType: over.vehicleType ?? "بسكليت",
    user: over.user ?? { id: "user-captain-map-1", fullName: "كابتن", phone: "+966511111111" },
    lastLocation: over.lastLocation ?? {
      captainId: over.id ?? "cap-map-1",
      latitude: 24.7136,
      longitude: 46.6753,
      recordedAt: new Date().toISOString(),
    },
    waitingOffers: over.waitingOffers ?? 0,
    activeOrders: over.activeOrders ?? 0,
    latestOrderNumber: over.latestOrderNumber ?? null,
    latestOrderStatus: over.latestOrderStatus ?? null,
    recentRejects: over.recentRejects ?? 0,
    assignmentOfferExpiresAt: over.assignmentOfferExpiresAt ?? null,
  };
}

export function mockNotificationItem(over: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: over.id ?? "notif-1",
    type: over.type ?? "SYSTEM",
    title: over.title ?? "تنبيه",
    body: over.body ?? "نص تجريبي",
    isRead: over.isRead ?? false,
    createdAt: over.createdAt ?? new Date().toISOString(),
  };
}

export function mockActivityItem(over: Partial<ActivityItem> = {}): ActivityItem {
  return {
    id: over.id ?? "act-1",
    action: over.action ?? "ORDER_CREATED",
    entityType: over.entityType ?? "Order",
    entityId: over.entityId ?? "order-1",
    metadata: over.metadata ?? {},
    createdAt: over.createdAt ?? new Date().toISOString(),
    user: over.user ?? null,
  };
}

export function mockUserListItem(over: Partial<UserListItem> = {}): UserListItem {
  const now = new Date().toISOString();
  return {
    id: over.id ?? "user-1",
    fullName: over.fullName ?? "مستخدم",
    phone: over.phone ?? "+966522222222",
    email: over.email ?? null,
    role: over.role ?? "DISPATCHER",
    isActive: over.isActive ?? true,
    createdAt: over.createdAt ?? now,
    updatedAt: over.updatedAt ?? now,
    customerPickupAddress: over.customerPickupAddress ?? null,
    customerDropoffAddress: over.customerDropoffAddress ?? null,
    customerLocationLink: over.customerLocationLink ?? null,
    customerArea: over.customerArea ?? null,
    customerDropoffLat: over.customerDropoffLat ?? null,
    customerDropoffLng: over.customerDropoffLng ?? null,
    customerPreferredAmount: over.customerPreferredAmount ?? null,
    customerPreferredDelivery: over.customerPreferredDelivery ?? null,
  };
}

export function mockStoreListItem(over: Partial<StoreListItem> = {}): StoreListItem {
  return {
    id: over.id ?? "store-1",
    name: over.name ?? "متجر تجريبي",
    phone: over.phone ?? "+966533333333",
    area: over.area ?? "الرياض",
    address: over.address ?? "عنوان",
    isActive: over.isActive ?? true,
  };
}

export function mockDashboardStats(over: Partial<DashboardStats> = {}): DashboardStats {
  return {
    ordersTotal: over.ordersTotal ?? 12,
    captainsActiveTotal: over.captainsActiveTotal ?? 5,
    pendingOrders: over.pendingOrders ?? 2,
    confirmedOrders: over.confirmedOrders ?? 1,
  };
}
