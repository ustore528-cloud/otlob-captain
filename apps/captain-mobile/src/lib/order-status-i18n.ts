import type { OrderStatusDto } from "@/services/api/dto";

export function orderStatusTranslationKey(status: OrderStatusDto): `orderStatus.${OrderStatusDto}` {
  return `orderStatus.${status}`;
}
