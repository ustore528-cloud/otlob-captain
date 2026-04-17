/**
 * عقود بيانات واجهة لوحة التحكم — أشكال متوافقة مع استجابات REST الحالية (`{ success, data }`).
 *
 * الربط الفعلي:
 * - `OrderListItem` ← `GET/POST /api/v1/orders` (قائمة وإنشاء)
 * - `CaptainListItem` ← `GET/POST /api/v1/captains`
 * - `UserListItem` ← `GET /api/v1/users`
 * - `ActiveMapCaptain` ← `GET /api/v1/tracking/captains/active-map`
 * - `CaptainStats` ← `GET /api/v1/captains/:id/stats`
 * - `DashboardStats` ← تجميع من `api.orders.list` + `api.captains.list` في `loadDashboardStats`
 *
 * بعد الطلبات/التوزيع: `invalidateOrderDistributionDomain` يحدّث الطلبات، لوحة الإحصاء، التتبع، والكباتن.
 */

export type { DashboardStats } from "@/lib/dashboard-stats";

export type {
  ActivityItem,
  ActiveMapCaptain,
  CaptainListItem,
  CaptainStats,
  NotificationItem,
  OrderListItem,
  OrderStatus,
  Paginated,
  StoreListItem,
  UserListItem,
} from "@/types/api";
