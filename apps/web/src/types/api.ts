/** أشكال JSON القادمة من API — مطابقة تقريبية لـ Prisma */

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

export type OrderListItem = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  distributionMode: DistributionMode;
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  dropoffAddress: string;
  area: string;
  amount: string;
  cashCollection: string;
  notes: string | null;
  createdAt: string;
  store: { id: string; name: string; area: string };
  assignedCaptain: null | {
    id: string;
    user: { fullName: string; phone: string };
  };
};

export type Paginated<T> = { total: number; items: T[] };

export type CaptainListItem = {
  id: string;
  vehicleType: string;
  area: string;
  isActive: boolean;
  availabilityStatus: string;
  lastSeenAt: string | null;
  user: { id: string; fullName: string; phone: string; isActive: boolean };
};

export type StoreListItem = {
  id: string;
  name: string;
  phone: string;
  area: string;
  address: string;
  isActive: boolean;
};

export type UserListItem = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  role: string;
  isActive: boolean;
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
  area: string;
  availabilityStatus: string;
  vehicleType: string;
  user: { fullName: string; phone: string };
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
