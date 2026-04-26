import { StoreSubscriptionType, type Prisma } from "@prisma/client";
import { AppError } from "../../utils/errors.js";

/**
 * For `SUPERVISOR_LINKED` stores, manual / drag-drop / reassign must target a captain
 * linked to the same `supervisorUserId` as the store. `PUBLIC` stores: no-op.
 * Runs before any assignment writes; read-only on DB.
 */
export async function assertCaptainSupervisorScopeForOrderTx(
  tx: Prisma.TransactionClient,
  order: { storeId: string | null },
  captain: { supervisorUserId: string | null },
): Promise<void> {
  if (!order.storeId) return;

  const store = await tx.store.findUnique({
    where: { id: order.storeId },
    select: { subscriptionType: true, supervisorUserId: true },
  });
  if (!store) {
    throw new AppError(404, "Store not found for this order", "NOT_FOUND");
  }
  if (store.subscriptionType !== StoreSubscriptionType.SUPERVISOR_LINKED) {
    return;
  }
  if (!store.supervisorUserId) {
    throw new AppError(
      400,
      "المتجر مضبوط كمرتبط بمشرف لكن لا يوجد مشرف مسجل — يُصلح من إعدادات المتجر.",
      "STORE_SUPERVISOR_INVALID",
    );
  }
  if (captain.supervisorUserId !== store.supervisorUserId) {
    throw new AppError(
      403,
      "هذا الكابتن خارج نطاق مشرف المتجر المحدد لهذا الطلب.",
      "CAPTAIN_SUPERVISOR_SCOPE",
    );
  }
}
