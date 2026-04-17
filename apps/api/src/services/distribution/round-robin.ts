import { $Enums, AssignmentResponseStatus, type Prisma } from "@prisma/client";

/**
 * عدد الجولات المكتملة (رفض أو انتهاء مهلة) لسلسلة AUTO فقط منذ إعادة ضبط التوزيع.
 * يحدد مؤشر الكابتن التالي: index = rounds % pool.length
 */
export async function countCompletedAutoRounds(
  tx: Prisma.TransactionClient,
  orderId: string,
  resetAt: Date,
): Promise<number> {
  return tx.orderAssignmentLog.count({
    where: {
      orderId,
      assignmentType: $Enums.AssignmentType.AUTO,
      responseStatus: {
        in: [AssignmentResponseStatus.EXPIRED, AssignmentResponseStatus.REJECTED],
      },
      assignedAt: { gte: resetAt },
    },
  });
}

export function pickCaptainAtRoundIndex<T extends { id: string }>(pool: T[], roundIndex: number): T | null {
  if (pool.length === 0) return null;
  return pool[roundIndex % pool.length] ?? null;
}

/** فهرس ثابت من معرف الطلب — يوزّع الطلبات الجديدة على الكباتن بدل اختيار أول كابتن دائمًا */
export function stablePoolIndexFromOrderId(orderId: string, modulo: number): number {
  if (modulo <= 0) return 0;
  let h = 0;
  for (let i = 0; i < orderId.length; i++) {
    h = (h * 31 + orderId.charCodeAt(i)) >>> 0;
  }
  return h % modulo;
}

/**
 * أول عرض: يعتمد على orderId. بعد رفض/انتهاء مهلة: يزيد completedRounds فينتقل للكابتن التالي في الدائرة.
 */
export function pickCaptainForAutoOffer<T extends { id: string }>(
  pool: T[],
  orderId: string,
  completedRounds: number,
): T | null {
  if (pool.length === 0) return null;
  const base = stablePoolIndexFromOrderId(orderId, pool.length);
  const idx = (base + completedRounds) % pool.length;
  return pool[idx] ?? null;
}
