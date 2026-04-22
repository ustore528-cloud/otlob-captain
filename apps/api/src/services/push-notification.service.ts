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
  const json = (await res.json().catch(() => null)) as
    | { data?: Array<{ status?: string; details?: { error?: string } }> }
    | null;
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

export const pushNotificationService = {
  async registerCaptainPushToken(input: {
    userId: string;
    token: string;
    platform: "android" | "ios";
    appVersion?: string | null;
  }): Promise<{ registered: boolean }> {
    const token = input.token.trim();
    if (!isExpoPushToken(token)) {
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
      if (rows.length === 0) return;
      const messages: ExpoPushMessage[] = rows
        .filter((r) => isExpoPushToken(r.token))
        .map((r) => ({
          to: r.token,
          title: payload.title,
          body: payload.body,
          sound: "default",
          channelId: "captain-orders",
          priority: "high",
          data: payload.data,
        }));
      if (messages.length === 0) return;
      // eslint-disable-next-line no-console
      console.info("[orders-action-timing]", {
        layer: "push_notification",
        action: "push_send",
        phase: "messages_built",
        userId,
        messages: messages.length,
        msFromEnter: Date.now() - t0,
      });

      const json = (await postExpoPush(messages)) as
        | { data?: Array<{ status?: string; details?: { error?: string } }> }
        | null;
      const tickets = json?.data ?? [];
      if (tickets.length > 0) {
        const invalidIndexes = tickets
          .map((t, i) => ({ t, i }))
          .filter((x) => x.t.status === "error" && x.t.details?.error === "DeviceNotRegistered")
          .map((x) => x.i);
        if (invalidIndexes.length > 0) {
          await prisma.captainPushToken.updateMany({
            where: {
              id: { in: invalidIndexes.map((i) => rows[i]!.id) },
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
};
