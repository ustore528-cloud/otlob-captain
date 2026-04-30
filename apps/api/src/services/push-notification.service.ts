import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";

const CAPTAIN_ORDER_CHANNEL_ID = "captain-orders-v9-strong";
const CAPTAIN_ORDER_ALERT_SOUND = "new_order_strong_alert";

type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  sound: typeof CAPTAIN_ORDER_ALERT_SOUND | "default";
  channelId: typeof CAPTAIN_ORDER_CHANNEL_ID;
  priority: "high";
  data?: Record<string, unknown>;
};

type CaptainPushLocale = "ar" | "en" | "he";
type CaptainPushTemplate = "NEW_ORDER" | "ORDER_STATUS_UPDATED";

const CAPTAIN_PUSH_TEXT: Record<CaptainPushTemplate, Record<CaptainPushLocale, { title: string; body: string }>> = {
  NEW_ORDER: {
    ar: {
      title: "طلب توصيل جديد",
      body: "لديك طلب جديد بانتظار القبول خلال 30 ثانية",
    },
    en: {
      title: "New delivery request",
      body: "You have a new order waiting for acceptance for 30 seconds",
    },
    he: {
      title: "בקשת משלוח חדשה",
      body: "יש לך הזמנה חדשה שממתינה לאישור למשך 30 שניות",
    },
  },
  ORDER_STATUS_UPDATED: {
    ar: {
      title: "تم تحديث حالة الطلب",
      body: "تم تحديث حالة الطلب الخاص بك",
    },
    en: {
      title: "Order status updated",
      body: "Your order status has been updated",
    },
    he: {
      title: "סטטוס ההזמנה עודכן",
      body: "סטטוס ההזמנה שלך עודכן",
    },
  },
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
  assignmentId?: string | null;
  orderNumber?: string | null;
  kind: "OFFER" | "REASSIGNED" | "ALERT";
  status?: string | null;
};

export type SendToCaptainUserOutcome = {
  userId: string;
  tokenRowsFound: number;
  validExpoTokenRows: number;
  expoTickets: ExpoPushTicket[];
  expoRawResponse: unknown;
};

function isExpoPushToken(token: string): boolean {
  return /^ExponentPushToken\[.+\]$/.test(token) || /^ExpoPushToken\[.+\]$/.test(token);
}

function normalizeCaptainPushLocale(locale: string | null | undefined): CaptainPushLocale {
  const base = (locale ?? "").split("-")[0];
  return base === "ar" || base === "he" ? base : "en";
}

function captainPushText(template: CaptainPushTemplate, locale: string | null | undefined): { title: string; body: string } {
  return CAPTAIN_PUSH_TEXT[template][normalizeCaptainPushLocale(locale)];
}

function inferCaptainPushTemplate(payload: {
  data?: Record<string, unknown>;
  template?: CaptainPushTemplate;
}): CaptainPushTemplate | undefined {
  if (payload.template) return payload.template;
  const type = typeof payload.data?.type === "string" ? payload.data.type : "";
  if (type === "NEW_ORDER" || type === "NEW_ORDER_TEST") return "NEW_ORDER";
  if (type === "ORDER_STATUS_UPDATED") return "ORDER_STATUS_UPDATED";
  return undefined;
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
  const json = (await res.json().catch(() => null)) as { data?: ExpoPushTicket[]; errors?: unknown } | null;
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
    // eslint-disable-next-line no-console
    console.error("[pushNotificationService.postExpoPush] expo_http_error", {
      status: res.status,
      body: json,
    });
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
    locale?: string | null;
  }): Promise<{ registered: boolean }> {
    const token = input.token.trim();
    const locale = normalizeCaptainPushLocale(input.locale);
    const captain = await prisma.captain.findFirst({
      where: { userId: input.userId },
      select: { id: true, companyId: true },
    });
    if (!isExpoPushToken(token)) {
      // eslint-disable-next-line no-console
      console.warn("[pushNotificationService.registerCaptainPushToken] invalid_expo_token", {
        userId: input.userId,
        captainId: captain?.id ?? null,
        companyId: captain?.companyId ?? null,
        platform: input.platform,
        tokenPrefix: token.slice(0, 24),
        validationResult: "REJECTED_NOT_EXPO_FORMAT",
      });
      return { registered: false };
    }
    const row = await prisma.captainPushToken.upsert({
      where: { token },
      update: {
        userId: input.userId,
        platform: input.platform,
        appVersion: input.appVersion ?? null,
        locale,
        isActive: true,
        lastSeenAt: new Date(),
      },
      create: {
        userId: input.userId,
        token,
        platform: input.platform,
        appVersion: input.appVersion ?? null,
        locale,
        isActive: true,
      },
    });
    // eslint-disable-next-line no-console
    console.info("[pushNotificationService.registerCaptainPushToken] token_upserted", {
      userId: input.userId,
      captainId: captain?.id ?? null,
      companyId: captain?.companyId ?? null,
      tokenId: row.id,
      platform: input.platform,
      appVersion: input.appVersion ?? null,
      locale,
      validationResult: "ACCEPTED_EXPO_FORMAT",
      token: `${token.slice(0, 18)}...${token.slice(-6)}`,
    });
    return { registered: true };
  },

  async sendToCaptainUser(
    userId: string,
    payload: {
      title: string;
      body: string;
      data?: Record<string, unknown>;
      template?: CaptainPushTemplate;
    },
  ): Promise<SendToCaptainUserOutcome | null> {
    const t0 = Date.now();
    try {
      const captain = await prisma.captain.findFirst({
        where: { userId },
        select: { id: true },
      });
      const tokenRepo = prisma.captainPushToken;
      if (!tokenRepo) {
        // Defensive guard: if runtime Prisma client is stale, skip push but keep API healthy.
        // eslint-disable-next-line no-console
        console.warn("[pushNotificationService.sendToCaptainUser] captainPushToken delegate unavailable");
        return null;
      }
      const rows = await tokenRepo.findMany({
        where: { userId, isActive: true },
        select: { id: true, token: true, platform: true, locale: true },
        take: 1,
        orderBy: { updatedAt: "desc" },
      });
      // eslint-disable-next-line no-console
      console.info("[orders-action-timing]", {
        layer: "push_notification",
        action: "push_send",
        phase: "active_tokens_loaded",
        userId,
        captainId: captain?.id ?? null,
        tokenRows: rows.length,
        platforms: rows.map((r) => r.platform),
        locales: rows.map((r) => r.locale ?? null),
        msFromEnter: Date.now() - t0,
      });
      if (rows.length === 0) {
        // eslint-disable-next-line no-console
        console.warn("[pushNotificationService.sendToCaptainUser] no_active_tokens", { userId });
        return {
          userId,
          tokenRowsFound: 0,
          validExpoTokenRows: 0,
          expoTickets: [],
          expoRawResponse: null,
        };
      }
      const validRows = rows.filter((r) => isExpoPushToken(r.token));
      const template = inferCaptainPushTemplate(payload);
      const messages: ExpoPushMessage[] = validRows.map((r) => {
        const localeUsed = normalizeCaptainPushLocale(r.locale);
        const localized = template ? captainPushText(template, localeUsed) : null;
        const sound = r.platform === "ios" ? "default" : CAPTAIN_ORDER_ALERT_SOUND;
        // eslint-disable-next-line no-console
        console.info("[pushNotificationService.sendToCaptainUser] message_built", {
          userId,
          captainId: captain?.id ?? null,
          tokenId: r.id,
          platform: r.platform,
          localeRaw: r.locale ?? null,
          localeUsed,
          titleLanguage: localized ? localeUsed : "caller_payload",
          channelId: CAPTAIN_ORDER_CHANNEL_ID,
          sound,
          template: template ?? null,
        });
        return {
          to: r.token,
          title: localized?.title ?? payload.title,
          body: localized?.body ?? payload.body,
          sound,
          channelId: CAPTAIN_ORDER_CHANNEL_ID,
          priority: "high",
          data: payload.data,
        };
      });
      if (messages.length === 0) {
        // eslint-disable-next-line no-console
        console.warn("[pushNotificationService.sendToCaptainUser] no_valid_expo_tokens", {
          userId,
          tokenRows: rows.length,
        });
        return {
          userId,
          tokenRowsFound: rows.length,
          validExpoTokenRows: 0,
          expoTickets: [],
          expoRawResponse: null,
        };
      }
      // eslint-disable-next-line no-console
      console.info("[orders-action-timing]", {
        layer: "push_notification",
        action: "push_send",
        phase: "messages_built",
        userId,
        captainId: captain?.id ?? null,
        messages: messages.length,
        msFromEnter: Date.now() - t0,
      });

      const json = (await postExpoPush(messages)) as { data?: ExpoPushTicket[] } | null;
      const tickets = json?.data ?? [];
      // eslint-disable-next-line no-console
      console.info("[captain-expo-push] ticket_response", {
        userId,
        captainId: captain?.id ?? null,
        channelId: CAPTAIN_ORDER_CHANNEL_ID,
        tokenRowsFound: rows.length,
        validExpoTokenRows: validRows.length,
        tickets: tickets.map((t) => ({
          status: t.status ?? null,
          id: t.id ?? null,
          message: t.message ?? null,
          error: t.details?.error ?? null,
        })),
        rawErrors: (json as { errors?: unknown } | null)?.errors ?? null,
        expoRawResponse: json ?? null,
      });
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
      return {
        userId,
        tokenRowsFound: rows.length,
        validExpoTokenRows: validRows.length,
        expoTickets: tickets,
        expoRawResponse: json ?? null,
      };
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[pushNotificationService.sendToCaptainUser]", {
        userId,
        error: e instanceof Error ? e.message : String(e),
      });
      return null;
    }
  },

  async sendCaptainOrderPush(input: CaptainOrderPushInput): Promise<void> {
    const captain = await prisma.captain.findFirst({
      where: { userId: input.userId },
      select: { id: true },
    });
    const activeTokenCount = await prisma.captainPushToken.count({
      where: { userId: input.userId, isActive: true },
    });
    // eslint-disable-next-line no-console
    console.info("[new-order-push] preparing push", {
      captainId: captain?.id ?? null,
      captainUserId: input.userId,
      orderId: input.orderId,
      assignmentId: input.assignmentId ?? null,
      numberOfTokensFound: activeTokenCount,
      title: input.title,
    });
    const outcome = await this.sendToCaptainUser(input.userId, {
      title: input.title,
      body: input.body,
      template: input.kind === "ALERT" ? "ORDER_STATUS_UPDATED" : "NEW_ORDER",
      data: {
        type: "NEW_ORDER",
        orderId: input.orderId,
        assignmentId: input.assignmentId ?? undefined,
        orderNumber: input.orderNumber ?? undefined,
        kind: input.kind,
        status: input.status ?? undefined,
      },
    });
    // eslint-disable-next-line no-console
    console.info("[new-order-push] expo ticket result", {
      orderId: input.orderId,
      assignmentId: input.assignmentId ?? null,
      captainId: captain?.id ?? null,
      captainUserId: input.userId,
      tokenRowsFound: outcome?.tokenRowsFound ?? null,
      validExpoTokenRows: outcome?.validExpoTokenRows ?? null,
      tickets:
        outcome?.expoTickets.map((t) => ({
          status: t.status ?? null,
          id: t.id ?? null,
          message: t.message ?? null,
          error: t.details?.error ?? null,
        })) ?? null,
      hadTransportError: outcome === null,
      expoRawResponse: outcome?.expoRawResponse ?? null,
    });
  },
};
