/**
 * Dev-only push diagnosis + test send for one captain.
 *
 * Usage:
 *   npx tsx scripts/send-test-push-to-captain.ts <captainId|userId|phone|email>
 *
 * Behavior:
 * - resolves captain
 * - loads latest active tokens
 * - infers token type/provider (EXPO / FCM / UNKNOWN)
 * - sends test push via the correct available sender
 * - prints full outcome/errors
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";
import { env } from "../src/config/env.js";
import { pushNotificationService } from "../src/services/push-notification.service.js";

type ExpoReceipt = { status?: string; message?: string; details?: { error?: string } };

async function fetchExpoReceiptsForDiag(receiptIds: string[]): Promise<{ data?: Record<string, ExpoReceipt> } | null> {
  if (receiptIds.length === 0) return null;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (env.EXPO_PUSH_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${env.EXPO_PUSH_ACCESS_TOKEN}`;
  }
  const res = await fetch("https://exp.host/--/api/v2/push/getReceipts", {
    method: "POST",
    headers,
    body: JSON.stringify({ ids: receiptIds }),
  });
  return (await res.json().catch(() => null)) as { data?: Record<string, ExpoReceipt> } | null;
}

type Provider = "EXPO" | "FCM" | "UNKNOWN";

function inferProvider(token: string): Provider {
  if (/^ExponentPushToken\[.+\]$/.test(token) || /^ExpoPushToken\[.+\]$/.test(token)) return "EXPO";
  // Common FCM token shape (long base64url-ish string with separators).
  if (/^[A-Za-z0-9:_-]{80,}$/.test(token) && !token.startsWith("ExponentPushToken[")) return "FCM";
  return "UNKNOWN";
}

function maskToken(token: string): string {
  if (token.length <= 30) return `${token.slice(0, 10)}...`;
  return `${token.slice(0, 18)}...${token.slice(-8)}`;
}

async function main(): Promise<void> {
  if (env.NODE_ENV === "production") {
    // eslint-disable-next-line no-console
    console.error("[send-test-push-to-captain] refused: NODE_ENV is production");
    process.exit(1);
  }

  const lookup = process.argv[2]?.trim();
  if (!lookup) {
    // eslint-disable-next-line no-console
    console.error(
      "[send-test-push-to-captain] usage: npx tsx scripts/send-test-push-to-captain.ts <captainId|userId|phone|email>",
    );
    process.exit(1);
  }

  const captain = await prisma.captain.findFirst({
    where: {
      OR: [{ id: lookup }, { userId: lookup }, { user: { phone: lookup } }, { user: { email: lookup } }],
    },
    select: {
      id: true,
      userId: true,
      companyId: true,
      user: { select: { phone: true, email: true } },
    },
  });

  if (!captain) {
    // eslint-disable-next-line no-console
    console.error("[send-test-push-to-captain] captain_not_found", { lookup });
    process.exit(2);
  }

  const tokenRows = await prisma.captainPushToken.findMany({
    where: { userId: captain.userId, isActive: true },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  const enriched = tokenRows.map((r) => {
    const inferred = inferProvider(r.token);
    // DB has no provider column currently; report inferred provider to detect mismatch.
    return {
      id: r.id,
      captainId: captain.id,
      companyId: captain.companyId,
      userId: captain.userId,
      token: r.token,
      tokenMasked: maskToken(r.token),
      provider: inferred,
      platform: r.platform,
      isActive: r.isActive,
      lastSeenAt: r.lastSeenAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  });

  // eslint-disable-next-line no-console
  console.info("[send-test-push-to-captain] captain", {
    captainId: captain.id,
    userId: captain.userId,
    companyId: captain.companyId,
    phone: captain.user.phone,
    email: captain.user.email,
  });
  // eslint-disable-next-line no-console
  console.info("[send-test-push-to-captain] active_tokens", {
    count: enriched.length,
    rows: enriched.map((r) => ({
      captainId: r.captainId,
      companyId: r.companyId,
      token: r.tokenMasked,
      provider: r.provider,
      platform: r.platform,
      isActive: r.isActive,
      lastSeenAt: r.lastSeenAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
  });

  if (enriched.length === 0) {
    // eslint-disable-next-line no-console
    console.warn("[send-test-push-to-captain] no_active_tokens");
    return;
  }

  const latest = enriched[0]!;
  // eslint-disable-next-line no-console
  console.info("[send-test-push-to-captain] token_type_decision", {
    latestToken: latest.tokenMasked,
    provider: latest.provider,
    note:
      latest.provider === "EXPO"
        ? "will send via Expo Push API"
        : latest.provider === "FCM"
          ? "FCM token detected but Firebase Admin sender is not implemented in this backend yet"
          : "token format unknown",
  });

  if (latest.provider !== "EXPO") {
    // eslint-disable-next-line no-console
    console.error("[send-test-push-to-captain] send_skipped_provider_not_supported", {
      provider: latest.provider,
      reason: "Only Expo sender exists in current backend service.",
    });
    process.exit(3);
  }

  const outcome = await pushNotificationService.sendToCaptainUser(captain.userId, {
    title: "New delivery request",
    body: "You have a new order waiting for acceptance for 30 seconds",
    template: "NEW_ORDER",
    data: {
      type: "NEW_ORDER_TEST",
      targetScreen: "notifications",
    },
  });

  const ticketSummaries =
    outcome?.expoTickets?.map((t) => ({
      status: t.status ?? null,
      id: t.id ?? null,
      message: t.message ?? null,
      error: t.details?.error ?? null,
    })) ?? null;
  const allTicketsOk =
    (outcome?.expoTickets?.length ?? 0) > 0 &&
    (outcome?.expoTickets ?? []).every((t) => t.status === "ok");

  // eslint-disable-next-line no-console
  console.info("[send-test-push-to-captain] send_result", {
    captainId: captain.id,
    companyId: captain.companyId,
    userId: captain.userId,
    senderUsed: "EXPO_PUSH_API",
    tokenRowsFound: outcome?.tokenRowsFound ?? null,
    validExpoTokenRows: outcome?.validExpoTokenRows ?? null,
    tickets: ticketSummaries,
    allTicketsOk,
    hadTransportError: outcome === null,
    raw: outcome?.expoRawResponse ?? null,
  });

  const receiptIds =
    outcome?.expoTickets?.map((t) => t.id).filter((id): id is string => typeof id === "string" && id.length > 0) ?? [];
  if (receiptIds.length > 0) {
    // eslint-disable-next-line no-console
    console.info("[send-test-push-to-captain] waiting_for_expo_receipts_ms", { ms: 18_000 });
    await new Promise((r) => setTimeout(r, 18_000));
    try {
      const receiptJson = await fetchExpoReceiptsForDiag(receiptIds);
      const data = receiptJson?.data ?? {};
      const receipts = receiptIds.map((id) => {
        const rec = data[id];
        return {
          ticketId: id,
          receiptStatus: rec?.status ?? null,
          error: rec?.details?.error ?? null,
          message: rec?.message ?? null,
        };
      });
      const allReceiptsOk =
        receipts.length > 0 && receipts.every((r) => r.receiptStatus === "ok" && !r.error);
      // eslint-disable-next-line no-console
      console.info("[send-test-push-to-captain] expo_push_receipts", { receipts, allReceiptsOk });
      if (!allReceiptsOk) {
        // eslint-disable-next-line no-console
        console.warn(
          "[send-test-push-to-captain] receipt indicates delivery/device issue — check Expo error codes (DeviceNotRegistered, etc.)",
        );
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[send-test-push-to-captain] receipt_fetch_failed", {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
}

void main();
