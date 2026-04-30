import type { StatusBadgeVariant } from "@/components/ui/status-badge";
import type { OrderStatusDto } from "@/services/api/dto";

/** تعيين بصري فقط — أسماء الحالة من الخادم دون تغيير */
export function mapOrderStatusDtoToBadgeVariant(status: OrderStatusDto): StatusBadgeVariant {
  switch (status) {
    case "PENDING":
      return "PENDING";
    case "CONFIRMED":
      return "CONFIRMED";
    case "ASSIGNED":
      return "ASSIGNED";
    case "ACCEPTED":
      return "ACCEPTED";
    case "PICKED_UP":
      return "PICKED_UP";
    case "IN_TRANSIT":
      return "IN_TRANSIT";
    case "DELIVERED":
      return "DELIVERED";
    case "CANCELLED":
      return "CANCELLED";
    default:
      return "NONE";
  }
}
