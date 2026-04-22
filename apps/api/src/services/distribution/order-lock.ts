import { Prisma } from "@prisma/client";

/**
 * قفل معاملات لكل طلب — يمنع سباقين على نفس orderId (queue-safe لعمليات التوزيع).
 * يستخدم pg_advisory_xact_lock يُطلق تلقائيًا عند نهاية المعاملة.
 */
export async function lockOrderDistributionTx(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
  const key = `distribution:order:${orderId}`;
  await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${key}::text))`);
}

/**
 * Captain-level transactional lock to serialize auto-offer capacity decisions.
 * Prevents two concurrent AUTO flows from assigning the same busy captain.
 */
export async function lockCaptainDistributionTx(
  tx: Prisma.TransactionClient,
  captainId: string,
): Promise<void> {
  const key = `distribution:captain:${captainId}`;
  await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${key}::text))`);
}
