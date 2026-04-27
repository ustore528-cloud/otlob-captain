/**
 * Dev-only: send a test Expo push through the same path as production (`sendToCaptainUser`).
 * Proves Expo + DB token without going through order distribution.
 *
 * Usage (from repo root or apps/api):
 *   npx tsx scripts/send-captain-test-push.ts <captainUserId>
 */
import "dotenv/config";
import { env } from "../src/config/env.js";
import { pushNotificationService } from "../src/services/push-notification.service.js";

async function main(): Promise<void> {
  if (env.NODE_ENV === "production") {
    // eslint-disable-next-line no-console
    console.error("[send-captain-test-push] refused: NODE_ENV is production");
    process.exit(1);
  }
  const userId = process.argv[2]?.trim();
  if (!userId) {
    // eslint-disable-next-line no-console
    console.error("[send-captain-test-push] usage: npx tsx scripts/send-captain-test-push.ts <captainUserId>");
    process.exit(1);
  }

  const outcome = await pushNotificationService.sendToCaptainUser(userId, {
    title: "Test New Order",
    body: "Testing captain push notification",
    data: { type: "NEW_ORDER_TEST" },
  });

  // eslint-disable-next-line no-console
  console.info("[send-captain-test-push] outcome", {
    userId,
    tokenRowsFound: outcome?.tokenRowsFound ?? null,
    validExpoTokenRows: outcome?.validExpoTokenRows ?? null,
    tickets: outcome?.expoTickets ?? null,
    hadTransportError: outcome === null,
  });
}

void main();
