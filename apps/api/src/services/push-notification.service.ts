import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";

type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  sound: "default";
  channelId: "captain-orders";
  priority: "high";
  data?: Record<string, unknown>;
};

type ExpoPushTicket = {
  status?: string;
  id?: string;
  message?: string;
  details?: { error?: string };
};

type ExpoPushReceipt = {
  status?: string;
  message?: string;
  details?: { error?: string };
};

type CaptainOrderPushInput = {
  userId: string;
  title: string;
  body: string;
  orderId: string;
  orderNumber?: string | null;
  kind: "OFFER" | "REASSIGNED" | "ALERT";
  status?: string | null;
};

function isExpoPushToken(token: string): boolean {
  return /^ExponentPushToken\[.+\]$/.test(token) || /^ExpoPushToken\[.+\]$/.test(token);
}

async function postExpoPush(messages: ExpoPushMessage[]): Promise<unknown> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (env.EXPO_PUSH_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${env.EXPO_PUSH_ACCESS_TOKEN}`;
  }
  const t0 = Date.now();
  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers,
    body: JSON.stringify(messages),
  });
  const headersAt = Date.now();
  const json = (await res.json().catch(() => null)) as { data?: ExpoPushTicket[] } | null;
  const bodyAt = Date.now();
  // eslint-disable-next-line no-console
  console.info("[orders-action-timing]", {
    layer: "push_notification",
    action: "push_send",
    phase: "expo_http_done",
    ttfbMs: headersAt - t0,
    totalHttpMs: bodyAt - t0,
    status: res.status,
    requestMessages: messages.length,
  });
  if (!res.ok) {
    throw new Error(`expo_push_http_${res.status}`);
  }
  return json;
}

async function postExpoReceipts(receiptIds: string[]): Promise<{ data?: Record<string, ExpoPushReceipt> } | null> {
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
  const json = (await res.json().catch(() => null)) as { data?: Record<string, ExpoPushReceipt> } | null;
  // eslint-disable-next-line no-console
  console.info("[pushNotificationService.checkExpoReceipts] http_done", {
    status: res.status,
    receiptIds: receiptIds.length,
  });
  if (!res.ok) {
    throw new Error(`expo_push_receipts_http_${res.status}`);
  }
  return json;
}

function scheduleExpoReceiptCheck(input: {
  userId: string;
  ticketTokenPairs: Array<{ ticketId: string; tokenId: string }>;
  data?: Record<string, unknown>;
}): void {
  if (input.ticketTokenPairs.length === 0) return;
  setTimeout(() => {
    void (async () => {
      try {
        const json = await postExpoReceipts(input.ticketTokenPairs.map((p) => p.ticketId));
        const receipts = json?.data ?? {};
        for (const pair of input.ticketTokenPairs) {
          const receipt = receipts[pair.ticketId];
          if (!receipt) {
            // eslint-disable-next-line no-console
            console.warn("[pushNotificationService.checkExpoReceipts] missing_receipt", {
              userId: input.userId,
              tokenId: pair.tokenId,
              ticketId: pair.ticketId,
            });
            continue;
          }
          if (receipt.status === "error") {
            // eslint-disable-next-line no-console
            console.error("[pushNotificationService.checkExpoReceipts] expo_receipt_error", {
              userId: input.userId,
              tokenId: pair.tokenId,
              ticketId: pair.ticketId,
              error: receipt.details?.error ?? "UNKNOWN_EXPO_RECEIPT_ERROR",
              message: receipt.message ?? null,
              data: input.data ?? null,
            });
            if (receipt.details?.error === "DeviceNotRegistered") {
              await prisma.captainPushToken.updateMany({
                where: { id: pair.tokenId },
                data: { isActive: false },
              });
            }
          } else {
            // eslint-disable-next-line no-console
            console.info("[pushNotificationService.checkExpoReceipts] expo_receipt_ok", {
              userId: input.userId,
              tokenId: pair.tokenId,
              ticketId: pair.ticketId,
            });
          }
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("[pushNotificationService.checkExpoReceipts]", {
          userId: input.userId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
  }, 15_000);
}

export const pushNotificationService = {
  async registerCaptainPushToken(input: {
    userId: string;
    token: string;
    platform: "android" | "ios";
    appVersion?: string | null;
  }): Promise<{ registered: boolean }> {
    const token = input.token.trim();
    if (!isExpoPushToken(token)) {
      // eslint-disable-next-line no-console
      console.warn("[pushNotificationService.registerCaptainPushToken] invalid_expo_token", {
        userId: input.userId,
        platform: input.platform,
        tokenPrefix: token.slice(0, 24),
      });
      return { registered: false };
    }
    await prisma.captainPushToken.upsert({
      where: { token },
      update: {
        userId: input.userId,
        platform: input.platform,
        appVersion: input.appVersion ?? null,
        isActive: true,
        lastSeenAt: new Date(),
      },
      create: {
        userId: input.userId,
        token,
        platform: input.platform,
        appVersion: input.appVersion ?? null,
        isActive: true,
      },
    });
    // eslint-disable-next-line no-console
    console.info("[pushNotificationService.registerCaptainPushToken] token_upserted", {
      userId: input.userId,
      platform: input.platform,
      appVersion: input.appVersion ?? null,
      token: `${token.slice(0, 18)}...${token.slice(-6)}`,
    });
    return { registered: true };
  },

  async sendToCaptainUser(
    userId: string,
    payload: { title: string; body: string; data?: Record<string, unknown> },
  ): Promise<void> {
    const t0 = Date.now();
    try {
      const tokenRepo = prisma.captainPushToken;
      if (!tokenRepo) {
        // Defensive guard: if runtime Prisma client is stale, skip push but keep API healthy.
        // eslint-disable-next-line no-console
        console.warn("[pushNotificationService.sendToCaptainUser] captainPushToken delegate unavailable");
        return;
      }
      const rows = await tokenRepo.findMany({
        where: { userId, isActive: true },
        select: { id: true, token: true },
        take: 10,
        orderBy: { updatedAt: "desc" },
      });
      // eslint-disable-next-line no-console
      console.info("[orders-action-timing]", {
        layer: "push_notification",
        action: "push_send",
        phase: "active_tokens_loaded",
        userId,
        tokenRows: rows.length,
        msFromEnter: Date.now() - t0,
      });
      if (rows.length === 0) {
        // eslint-disable-next-line no-console
        console.warn("[pushNotificationService.sendToCaptainUser] no_active_tokens", { userId });
        return;
      }
      const validRows = rows.filter((r) => isExpoPushToken(r.token));
      const messages: ExpoPushMessage[] = validRows.map((r) => ({
          to: r.token,
          title: payload.title,
          body: payload.body,
          sound: "default",
          channelId: "captain-orders",
          priority: "high",
          data: payload.data,
        }));
      if (messages.length === 0) {
        // eslint-disable-next-line no-console
        console.warn("[pushNotificationService.sendToCaptainUser] no_valid_expo_tokens", {
          userId,
          tokenRows: rows.length,
        });
        return;
      }
      // eslint-disable-next-line no-console
      console.info("[orders-action-timing]", {
        layer: "push_notification",
        action: "push_send",
        phase: "messages_built",
        userId,
        messages: messages.length,
        msFromEnter: Date.now() - t0,
      });

      const json = (await postExpoPush(messages)) as { data?: ExpoPushTicket[] } | null;
      const tickets = json?.data ?? [];
      if (tickets.length > 0) {
        const okTicketTokenPairs = tickets
          .map((t, i) => ({ ticketId: t.id, tokenId: validRows[i]?.id }))
          .filter((x): x is { ticketId: string; tokenId: string } => Boolean(x.ticketId && x.tokenId));
        scheduleExpoReceiptCheck({
          userId,
          ticketTokenPairs: okTicketTokenPairs,
          data: payload.data,
        });
        const errorTickets = tickets
          .map((t, i) => ({ t, i }))
          .filter((x) => x.t.status === "error");
        for (const { t, i } of errorTickets) {
          // eslint-disable-next-line no-console
          console.error("[pushNotificationService.sendToCaptainUser] expo_ticket_error", {
            userId,
            tokenId: validRows[i]?.id ?? null,
            error: t.details?.error ?? "UNKNOWN_EXPO_TICKET_ERROR",
            message: t.message ?? null,
            data: payload.data ?? null,
          });
        }

        const invalidIndexes = errorTickets
          .filter((x) => x.t.details?.error === "DeviceNotRegistered")
          .map((x) => x.i);
        if (invalidIndexes.length > 0) {
          await prisma.captainPushToken.updateMany({
            where: {
              id: { in: invalidIndexes.map((i) => validRows[i]!.id) },
            },
            data: { isActive: false },
          });
        }
      }
      // eslint-disable-next-line no-console
      console.info("[orders-action-timing]", {
        layer: "push_notification",
        action: "push_send",
        phase: "completed",
        userId,
        ticketCount: tickets.length,
        totalMs: Date.now() - t0,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[pushNotificationService.sendToCaptainUser]", {
        userId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },

  async sendCaptainOrderPush(input: CaptainOrderPushInput): Promise<void> {
    await this.sendToCaptainUser(input.userId, {
      title: input.title,
      body: input.body,
      data: {
        orderId: input.orderId,
        orderNumber: input.orderNumber ?? undefined,
        kind: input.kind,
        status: input.status ?? undefined,
      },
    });
  },
};
