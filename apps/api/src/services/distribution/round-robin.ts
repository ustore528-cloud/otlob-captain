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
